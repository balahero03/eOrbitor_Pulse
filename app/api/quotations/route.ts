import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { leadQuoteNumber } from '@/lib/leadNumber';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const leadId = searchParams.get('leadId');

  const where: any = {};

  // If fetching by leadId, skip role scoping — the lead page already enforces access
  if (!leadId) {
    if (user.role === 'ON_FIELD_TEAM') {
      where.createdById = user.id;
    } else if (user.role === 'BACKEND_TEAM') {
      const teamMembers = await prisma.user.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
      where.createdById = { in: teamIds };
    }
  }

  if (leadId) where.leadId = leadId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { quotationNumber: { contains: search, mode: 'insensitive' } },
      { customer: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
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
        createdBy: { select: { firstName: true, lastName: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quotation.count({ where }),
  ]);

  return NextResponse.json({
    quotations,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const {
    leadId, customerId, items, notes,
    priceValidity, taxDetails, warranty, amcPeriod, deliveryEstimate, paymentTerms,
    discountAmount: discountInput,
  } = await req.json();

  if (!items || items.length === 0) {
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
      select: { id: true, company: true, address: true, linkedCustomerId: true, quoteNo: true },
    });
    if (!resolvedLead) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
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
      const newCustomer = await prisma.customer.create({
        data: {
          companyName: resolvedLead.company,
          gstNumber: `PENDING-${Date.now()}`,
          website: '',
          industry: '',
          billingAddress: resolvedLead.address ? { street: resolvedLead.address } : undefined,
        },
      });
      resolvedCustomerId = newCustomer.id;
      await prisma.lead.update({
        where: { id: resolvedLead.id },
        data: { linkedCustomerId: newCustomer.id },
      });
    }
  }

  // Quotations are raised tax-exclusive — GST is not charged on the quote
  // itself (it's applied later at PO/invoice). taxAmount is always 0.
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.quantity * item.unitPrice;
  }
  const taxAmount = 0;

  const discount = Number(discountInput || 0);
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
          ...(leadId && { leadId }),
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
