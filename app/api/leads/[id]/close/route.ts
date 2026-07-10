import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { sendMail, buildWonEmail, buildLostEmail, MailAttachment } from '@/lib/mail';
import { saveBase64Files } from '@/lib/storage';

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

    // Build mail attachments from base64 (transient — for the notification email)
    const attachments: MailAttachment[] = (rawAttachments as any[])
      .filter((a: any) => a?.dataBase64 && a?.filename)
      .map((a: any) => ({
        filename: a.filename,
        content: Buffer.from(a.dataBase64, 'base64'),
        contentType: a.contentType || 'application/octet-stream',
      }));

    // Recipients
    const [managers, admins] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: await getManagerIds(lead.assignedToId) } },
        select: { email: true, firstName: true, lastName: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        select: { email: true, firstName: true, lastName: true },
      }),
    ]);

    const notifyEmails = [...new Set([
      ...managers.map(m => m.email),
      ...admins.map(a => a.email),
    ])].filter(Boolean) as string[];

    const repName     = `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`;
    const managerName = managers[0]
      ? `${managers[0].firstName} ${managers[0].lastName}`
      : 'Manager';
    const attachmentNames = attachments.map(a => a.filename);
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
          },
        });
        customerId = newCustomer.id;
      }

      // Auto-create an Order record from the won lead
      const orderCount = await prisma.order.count();
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

      await prisma.order.create({
        data: {
          orderNumber,
          customerId,
          poNumber: poNumber || null,
          totalAmount: lead.quoteValue ? lead.quoteValue.toString() : '0',
          amountPaid: '0',
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

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

      if (notifyEmails.length > 0) {
        await sendMail({
          to: notifyEmails,
          subject: `🏆 Lead WON — ${lead.company} (${lead.name})${lead.quoteValue ? ` · ₹${Number(lead.quoteValue).toLocaleString('en-IN')}` : ''}`,
          html: buildWonEmail({
            lead: { name: lead.name, company: lead.company, quoteValue: lead.quoteValue },
            rep: repName, manager: managerName,
            quoteRef, poNumber, reasonOfWin, whatWentWell, attachmentNames,
          }),
          attachments,
        });
      }

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

    if (notifyEmails.length > 0) {
      await sendMail({
        to: notifyEmails,
        subject: `${outcome === 'LOST' ? '❌ Lead LOST' : '🚫 Lead DROPPED'} — ${lead.company} (${lead.name})`,
        html: buildLostEmail({
          lead: { name: lead.name, company: lead.company, quoteValue: lead.quoteValue },
          outcome: outcome as 'LOST' | 'DROPPED',
          reason, rep: repName, competitor, whatToImprove, attachmentNames,
        }),
        attachments,
      });
    }

    return NextResponse.json({ outcome: newStatus, lead: updated, message: `Lead marked as ${newStatus}.` });
  })(req);
}

async function getManagerIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });
  return user?.managerId ? [user.managerId] : [];
}
