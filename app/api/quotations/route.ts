import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseEnumParam } from '@/lib/queryFilters';
import { QuotationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { leadQuoteNumber } from '@/lib/leadNumber';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { parseMoneyInput } from '@/lib/money';

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'];

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Whether `user` may see a lead assigned to `assignedToId` — the same rule the
// leads routes use: on-field sees only their own, backend sees self + their
// reports, admins see everything.
async function canAccessLead(user: AuthUser, assignedToId: string | null): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return assignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!assignedToId) return false;
    return (await getTeamIds(user.id)).includes(assignedToId);
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = parseEnumParam(searchParams.get('status'), QuotationStatus, 'quotation status');
  const search = sanitizeSearch(searchParams.get('search'));

  const leadId = searchParams.get('leadId');

  const where: any = {};

  if (leadId) {
    // Lead-scoped view. This branch used to skip role scoping entirely on the
    // grounds that "the lead page already enforces access" — but that check is
    // client-side, so any user could read another team's quotations (and their
    // values) just by passing a guessed ?leadId=. Authorise against the lead
    // itself instead: whoever can see the lead sees every quotation on it,
    // including ones raised by a colleague, and nobody else sees any.
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { assignedToId: true, deletedAt: true },
    });

    if (!lead || lead.deletedAt) {
      return NextResponse.json({
        quotations: [],
        pagination: { page, limit, total: 0, pages: 0 },
      });
    }
    if (!(await canAccessLead(user, lead.assignedToId))) {
      throw new ForbiddenError('You do not have access to this lead.');
    }

    where.leadId = leadId;
  } else if (user.role === 'ON_FIELD_TEAM') {
    where.createdById = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    where.createdById = { in: await getTeamIds(user.id) };
  }

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { quotationNumber: { contains: search, mode: 'insensitive' } },
      { customer: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, quotationNumber: true, status: true, leadId: true,
        customer: { select: { id: true, companyName: true } },
        deal: { select: { id: true, dealName: true } },
        subtotal: true, taxAmount: true, discountAmount: true, totalAmount: true,
        issueDate: true, expiryDate: true, sentAt: true, approvedAt: true,
        priceValidity: true, taxDetails: true, warranty: true, amcPeriod: true,
        deliveryEstimate: true, paymentTerms: true, notes: true, items: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quotation.count({ where }),
  ]);

  return NextResponse.json({
    quotations,
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const {
    leadId, customerId, items, notes,
    priceValidity, taxDetails, warranty, amcPeriod, deliveryEstimate, paymentTerms,
    discountAmount: discountInput,
  } = await req.json();

  // `Array.isArray` rather than a truthiness check: a JSON string has a
  // `.length` too, so `items: "abc"` passed this guard and then iterated
  // character by character.
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { message: 'At least one item is required' },
      { status: 400 }
    );
  }

  // Resolve the customer. Quotes can be raised from the PROSPECT stage before a
  // lead is won — in that case no customer exists yet, so auto-create one from
  // the lead (mirrors the win flow, which reuses linkedCustomer to avoid dupes).
  let resolvedLead = null;
  if (leadId) {
    resolvedLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, company: true, address: true, linkedCustomerId: true, quoteNo: true, assignedToId: true },
    });
    if (!resolvedLead) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }
  }

  // Quotation-creation permission: by default only an admin/manager or the
  // lead's assigned owner may quote it. An admin can disable this globally
  // via QuotationPolicy so any user can quote any lead — a temporary,
  // reversible override rather than a role change.
  if (!MANAGER_ROLES.includes(user.role)) {
    const policy = await prisma.quotationPolicy.findUnique({ where: { id: 'singleton' } });
    if (!policy?.restrictionsDisabled) {
      if (!resolvedLead || resolvedLead.assignedToId !== user.id) {
        throw new ForbiddenError('You can only create quotations for leads assigned to you.');
      }
    }
  }

  let resolvedCustomerId: string | undefined = customerId;
  if (!resolvedCustomerId) {
    if (!leadId || !resolvedLead) {
      return NextResponse.json(
        { message: 'customerId or leadId is required' },
        { status: 400 }
      );
    }

    if (resolvedLead.linkedCustomerId) {
      resolvedCustomerId = resolvedLead.linkedCustomerId;
    } else {
      // Read-then-write: two quotations raised for the same unlinked lead at
      // once would each see linkedCustomerId as null and create their own
      // Customer, leaving duplicate companies in the master. Claim the link
      // with a conditional update so exactly one writer can win; the loser
      // drops its now-orphaned customer and reuses the winner's.
      // The placeholder GST also carries a random suffix — Date.now() alone
      // collides for two creates inside the same millisecond, and gstNumber
      // is unique.
      const placeholderGst = `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newCustomer = await prisma.customer.create({
        data: {
          companyName: resolvedLead.company,
          gstNumber: placeholderGst,
          website: '',
          industry: '',
          billingAddress: resolvedLead.address ? { street: resolvedLead.address } : undefined,
        },
      });

      const claim = await prisma.lead.updateMany({
        where: { id: resolvedLead.id, linkedCustomerId: null },
        data: { linkedCustomerId: newCustomer.id },
      });

      if (claim.count === 1) {
        resolvedCustomerId = newCustomer.id;
      } else {
        const winner = await prisma.lead.findUnique({
          where: { id: resolvedLead.id },
          select: { linkedCustomerId: true },
        });
        if (winner?.linkedCustomerId) {
          resolvedCustomerId = winner.linkedCustomerId;
          // Best-effort cleanup — the quotation is still valid if this fails.
          await prisma.customer.delete({ where: { id: newCustomer.id } }).catch(() => {});
        } else {
          // Link vanished rather than being taken (lead deleted mid-flight);
          // keep our customer instead of orphaning the quotation.
          resolvedCustomerId = newCustomer.id;
        }
      }
    }
  }

  // Quotations are raised tax-exclusive — GST is not charged on the quote
  // itself (it's applied later at PO/invoice). taxAmount is always 0.
  //
  // Every figure below arrived unchecked. `item.quantity * item.unitPrice` on
  // free text is NaN, and `NaN.toString()` is the string "NaN", which is what
  // reached the Decimal column — so one mistyped price failed the whole
  // request as a server error rather than pointing at the line it came from.
  let subtotal = 0;
  items.forEach((item: any, i: number) => {
    const qty = parseMoneyInput(item?.quantity);
    const price = parseMoneyInput(item?.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ValidationError(`Line ${i + 1}: quantity must be a number greater than zero.`);
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new ValidationError(`Line ${i + 1}: unit price must be a number that is not negative.`);
    }
    subtotal += qty * price;
  });
  const taxAmount = 0;

  // A discount was subtracted with nothing stopping it exceeding the subtotal,
  // so a quotation could be saved with a negative total — and
  // /quotations/[id]/convert-to-order carries that value straight onto the
  // order, where it becomes negative revenue in the dashboard and reports.
  const discount = discountInput === undefined || discountInput === null || discountInput === ''
    ? 0
    : parseMoneyInput(discountInput);
  if (!Number.isFinite(discount) || discount < 0) {
    throw new ValidationError('Discount must be a number that is not negative.');
  }
  if (discount > subtotal) {
    throw new ValidationError(
      `The discount (₹${discount.toLocaleString('en-IN')}) is more than the quotation subtotal (₹${subtotal.toLocaleString('en-IN')}).`
    );
  }
  const totalAmount = subtotal - discount;

  // Number generation is read-then-write (count/last-row lookup, then insert),
  // so two near-simultaneous creates can compute the same number. Retry a few
  // times on a unique-constraint collision, re-deriving the number from fresh
  // DB state each attempt, rather than failing the whole request.
  const nextQuotationNumber = async (bump: number): Promise<string> => {
    if (leadId && resolvedLead?.quoteNo) {
      const existingCount = await prisma.quotation.count({ where: { leadId } });
      return leadQuoteNumber(resolvedLead.quoteNo, existingCount + bump);
    }

    const lastQuotation = await prisma.quotation.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { quotationNumber: true },
    });

    let nextNumber = 1;
    if (lastQuotation?.quotationNumber) {
      const match = lastQuotation.quotationNumber.match(/EO-QT-\d+-(\d+)/) || lastQuotation.quotationNumber.match(/QT-\d+-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    return `QT-${new Date().getFullYear()}-${String(nextNumber + bump).padStart(4, '0')}-A`;
  };

  const MAX_ATTEMPTS = 5;
  let quotation;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const quotationNumber = await nextQuotationNumber(attempt);
    try {
      quotation = await prisma.quotation.create({
        data: {
          quotationNumber,
          customerId: resolvedCustomerId!,
          ...(leadId && { leadId, dealId: leadId }),
          status: 'DRAFT',
          items,
          subtotal: subtotal.toString(),
          taxAmount: taxAmount.toString(),
          discountAmount: discount.toString(),
          totalAmount: totalAmount.toString(),
          issueDate: new Date(),
          ...(priceValidity && { priceValidity }),
          ...(taxDetails && { taxDetails }),
          ...(warranty && { warranty }),
          ...(amcPeriod && { amcPeriod }),
          ...(deliveryEstimate && { deliveryEstimate }),
          ...(paymentTerms && { paymentTerms }),
          ...(notes && { notes }),
          createdById: user.id,
        },
        include: {
          customer: { select: { companyName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      });
      break;
    } catch (err: any) {
      const isNumberCollision = err?.code === 'P2002' && err?.meta?.target?.includes?.('quotationNumber');
      if (isNumberCollision && attempt < MAX_ATTEMPTS - 1) continue;
      throw err;
    }
  }

  return NextResponse.json(quotation, { status: 201 });
});
