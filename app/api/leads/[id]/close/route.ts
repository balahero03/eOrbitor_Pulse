import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError, ValidationError } from '@/lib/errors';
// Closing a lead no longer sends email. Outbound mail is reserved for password
// reset and account recovery (see the policy note at the top of lib/mail.ts);
// managers and admins are told about a closure in-app instead, through the same
// notification mechanism every other cross-team event in the app already uses.
import { notifyAdminsAndManagers } from '@/lib/notify';
import { saveBase64Files } from '@/lib/storage';
import { createWithOrderNumber } from '@/lib/orderNumber';
import { parseMoneyInput } from '@/lib/money';
import { derivePaymentDueDate } from '@/lib/paymentTerms';

/**
 * A date field off the closure form, or null.
 *
 * The form sends `''` for a date the user left alone, and `new Date('')` is an
 * Invalid Date — which Prisma rejects at write time with an error naming a
 * column the user has never heard of. Anything unparseable becomes null.
 */
function toDateOrNull(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(async (req: NextRequest, user: AuthUser) => {
    // Body: JSON with optional base64 attachments
    // { outcome, reason, quoteRef, poNumber, reasonOfWin, whatWentWell,
    //   competitor, whatToImprove,
    //   attachments: [{ filename, contentType, dataBase64 }] }
    const body = await req.json();
    const {
      outcome,
      reason        = '',
      quotationId   = '',
      quoteRef      = '',
      poNumber      = '',
      reasonOfWin   = '',
      whatWentWell  = '',
      competitor    = '',
      whatToImprove = '',
      attachments: rawAttachments = [],
      closureDetails: incomingClosureDetails,
    } = body;

    if (!['WON', 'LOST', 'DROPPED'].includes(outcome)) {
      throw new ValidationError('outcome must be WON, LOST, or DROPPED');
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        broughtBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }) as any;

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }

    const canClose =
      ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role) ||
      lead.assignedToId === user.id;
    if (!canClose) throw new ForbiddenError();

    if (lead.status !== 'CLOSURE') {
      throw new ValidationError('Lead must be at CLOSURE stage before closing');
    }

    // Persist uploads to disk (durable storage, downloadable later)
    const storedFiles = saveBase64Files(
      `leads/${id}`,
      (rawAttachments as any[]).filter((a: any) => a?.dataBase64 && a?.filename),
    );

    // filter(Boolean) rather than a template literal: accounts without a
    // surname (the seeded admin, for one) otherwise render as "Admin  closed"
    // with a doubled space.
    const repName = [lead.assignedTo.firstName, lead.assignedTo.lastName].filter(Boolean).join(' ');
    // Taken from what was actually written to disk rather than re-derived from
    // the request. Every upload used to be base64-decoded into a second
    // in-memory Buffer purely so it could ride along on the notification email;
    // with the email gone, the stored descriptors are the only copy needed.
    const attachmentNames = storedFiles.map(f => f.filename);
    // Metadata for the download UI — excludes storagePath from the client-facing shape
    const attachmentMeta = storedFiles.map(f => ({
      id: f.id,
      filename: f.filename,
      contentType: f.contentType,
      size: f.size,
      storagePath: f.storagePath,
      uploadedAt: f.uploadedAt,
    }));

    // Merge with existing stage details (approach/negotiation captured during pipeline)
    const existingStageDetails = (lead.closureDetails as any) || {};
    const baseClosureDetails = incomingClosureDetails || existingStageDetails;

    // Preserve any attachments stored on a prior save, append the new ones
    const priorAttachments = Array.isArray(existingStageDetails.attachments)
      ? existingStageDetails.attachments
      : [];
    const allAttachments = [...priorAttachments, ...attachmentMeta];

    const closureDetails =
      outcome === 'WON'
        ? { ...baseClosureDetails, quoteRef, poNumber, reasonOfWin, whatWentWell, attachmentNames, attachments: allAttachments }
        : { ...baseClosureDetails, reason, competitor, whatToImprove, attachmentNames, attachments: allAttachments };

    if (outcome === 'WON') {
      // Auto-create a Customer from the won lead if one doesn't already exist
      let customerId = lead.linkedCustomerId;
      if (!customerId) {
        const newCustomer = await prisma.customer.create({
          data: {
            companyName: lead.company,
            billingAddress: lead.address ? { street: lead.address } : undefined,
            gstNumber: `PENDING-${Date.now()}`,
            website: '',
            industry: '',
            // The lead already carries the person we've been dealing with, so
            // carry them over as the primary contact. Without this the new
            // customer had a company name and nothing else — no one to call —
            // and the Customers list showed a row of dashes even though the
            // details were sitting on the lead that created it.
            ...(lead.email || lead.phone || lead.name
              ? {
                  contacts: {
                    create: {
                      name: lead.name || lead.company,
                      email: lead.email || '',
                      phone: lead.phone || null,
                      isPrimary: true,
                    },
                  },
                }
              : {}),
          },
        });
        customerId = newCustomer.id;
      }

      // Auto-create an Order record from the won lead

      // The order's value comes from the quotation the customer actually
      // accepted, falling back to the lead's own quote figure. Previously only
      // `lead.quoteValue` was consulted, so a lead whose value lived on its
      // quotation produced a ₹0 order — and because no quotation was linked
      // either, nothing downstream could recover the number. Someone then had
      // to retype it by hand.
      // The quote the user picked in the closure modal is authoritative — it
      // is the one the customer actually accepted. Only when nothing was
      // picked do we guess: an ACCEPTED quote, else the most recent.
      const chosen = quotationId
        ? await prisma.quotation.findFirst({
            // Scoped to this lead so a stray id cannot attach someone else's
            // quotation (and its value) to this order.
            where: { id: quotationId, leadId: id },
            select: { id: true, totalAmount: true },
          })
        : null;

      const accepted =
        chosen ??
        (await prisma.quotation.findFirst({
          where: { leadId: id, status: 'ACCEPTED' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, totalAmount: true },
        })) ??
        (await prisma.quotation.findFirst({
          where: { leadId: id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, totalAmount: true },
        }));

      // Winning the deal is what makes a quote accepted; recording that here
      // keeps the quotation list honest instead of leaving the winning quote
      // sitting in DRAFT/SENT forever.
      if (chosen) {
        await prisma.quotation.update({
          where: { id: chosen.id },
          data: { status: 'ACCEPTED' },
        });
      }

      const dealForOrder = await prisma.deal.findFirst({
        where: { leadId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      // ── What the order is worth ──────────────────────────────────────────
      //
      // The closure form makes the rep enter a Final Deal Value, Payment Terms
      // and a Delivery Date before it will submit — and none of it used to
      // reach the order. The order was built from the quotation, falling back
      // to `lead.quoteValue`, so a lead with neither produced a ₹0 order and
      // the rep had to type the same figure a second time into Edit Order
      // before a single payment could be recorded against it.
      //
      // finalDealValue now ranks *above* the quotation. The form pre-fills it
      // from the selected quote and says "override only if the final figure
      // differs", so in the ordinary case they are the same number — and where
      // they differ, the one the human confirmed last is the right one. The
      // quotation is still linked either way, so the order page can always
      // show where its figure came from.
      const closureBlock = (closureDetails as any)?.closure ?? {};
      const finalDealValue = parseMoneyInput(closureBlock.finalDealValue);
      const leadValue = lead.quoteValue ? Number(lead.quoteValue) : 0;
      const quoteValue = accepted ? Number(accepted.totalAmount) : 0;

      const orderTotal =
        Number.isFinite(finalDealValue) && finalDealValue > 0 ? finalDealValue
        : quoteValue > 0 ? quoteValue
        : leadValue;

      // Refuse rather than create a ₹0 order. Every downstream action —
      // recording a payment, computing a balance, chasing what is owed — is
      // blocked by a zero total, so an order in that state is not a record of
      // a win, it is a task someone has to come back and finish. The form
      // already requires the value, so a genuine user cannot reach this.
      if (!(orderTotal > 0)) {
        throw new ValidationError(
          'This lead has no value to carry to the order. Enter the Final Deal Value on the closure form, or link the accepted quotation.'
        );
      }

      // The PO date anchors the payment due date, so it matters that it is set.
      // Contract Signed Date is the closest thing the closure form captures;
      // before this the field was left null on every auto-created order.
      const poDateValue = toDateOrNull(closureBlock.contractSignedDate);
      const deliveryDateValue = toDateOrNull(closureBlock.deliveryDateFinal);
      const paymentTerms = String(closureBlock.paymentTermsFinal || '').trim() || null;

      const createdOrder = await createWithOrderNumber((orderNumber) =>
        prisma.order.create({
        data: {
          orderNumber,
          customerId,
          // Linking the quotation and the deal is what lets the order page
          // show where its figure came from, and lets a correction be checked
          // against the source instead of guessed at.
          quotationId: accepted?.id ?? null,
          dealId: dealForOrder?.id ?? null,
          poNumber: poNumber || null,
          poDate: poDateValue,
          deliveryDate: deliveryDateValue,
          paymentTerms,
          // Derived from the terms against the PO date. Unrecognised terms
          // ("as agreed", a staged 50/50) yield null rather than a guess —
          // see lib/paymentTerms.ts for why a wrong due date is worse than none.
          paymentDueDate: derivePaymentDueDate(paymentTerms, poDateValue ?? new Date()),
          totalAmount: orderTotal.toString(),
          amountPaid: '0',
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
        })
      );

      const updated = await prisma.lead.update({
        where: { id },
        data: {
          status: 'ORDER',
          closedAt: new Date(),
          closureReason: reasonOfWin || null,
          closureDetails: closureDetails as any,
          linkedCustomerId: customerId,
        } as any,
        include: {
          assignedTo: { select: { firstName: true, lastName: true } },
          linkedCustomer: { select: { id: true, companyName: true } },
        },
      });

      // ORDER_CONFIRMED rather than a lead-shaped type: an order was just
      // raised, and that order is what the recipient has to act on. The
      // notification shell resolves this type straight to the order page.
      await notifyAdminsAndManagers(
        'ORDER_CONFIRMED',
        'Opportunity Won',
        `${repName} closed ${lead.company} (${lead.name}) as won${orderTotal > 0 ? ` for ₹${orderTotal.toLocaleString('en-IN')}` : ''}. An order has been raised.`,
        'ORDER',
        createdOrder.id,
        user.id,
      );

      return NextResponse.json({ outcome: 'WON', lead: updated, message: 'Lead won! Auto-converted to Customer and moved to Orders.' });
    }

    // LOST or DROPPED
    const newStatus = outcome === 'LOST' ? 'LOST' : 'DROPPED';

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: newStatus,
        closedAt: new Date(),
        closureReason: reason || null,
        closureDetails: closureDetails as any,
      } as any,
      include: { assignedTo: { select: { firstName: true, lastName: true } } },
    });

    // DEAL_UPDATED resolves to the lead itself, where the closure reason and
    // any attached documents are recorded.
    await notifyAdminsAndManagers(
      'DEAL_UPDATED',
      `Opportunity ${outcome === 'LOST' ? 'Lost' : 'Dropped'}`,
      `${repName} closed ${lead.company} (${lead.name}) as ${newStatus.toLowerCase()}` +
        `${competitor ? ` to ${competitor}` : ''}${reason ? `. Reason: ${reason}` : '.'}`,
      'LEAD',
      id,
      user.id,
    );

    return NextResponse.json({ outcome: newStatus, lead: updated, message: `Lead marked as ${newStatus}.` });
  })(req);
}
