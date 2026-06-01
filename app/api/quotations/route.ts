import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

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
    if (user.role === 'SALES_EXEC') {
      where.createdById = user.id;
    } else if (user.role === 'SALES_MANAGER') {
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

  if (!customerId || !items || items.length === 0) {
    return NextResponse.json(
      { message: 'customerId and at least one item are required' },
      { status: 400 }
    );
  }

  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const lineSubtotal = item.quantity * item.unitPrice;
    subtotal += lineSubtotal;
    // Use per-item taxRate if provided, otherwise lookup product tax
    if (item.taxRate !== undefined) {
      taxAmount += lineSubtotal * (Number(item.taxRate) / 100);
    } else if (item.productId) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product) taxAmount += lineSubtotal * (Number(product.tax) / 100);
    }
  }

  const discount = Number(discountInput || 0);
  const totalAmount = subtotal + taxAmount - discount;

  // Get the last quotation number to ensure sequential generation
  const lastQuotation = await prisma.quotation.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { quotationNumber: true },
  });

  // Extract the number and increment
  let nextNumber = 1;
  if (lastQuotation?.quotationNumber) {
    const match = lastQuotation.quotationNumber.match(/QT-\d+-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  const quotationNumber = `QT-${new Date().getFullYear()}-${String(nextNumber).padStart(5, '0')}`;

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      customerId,
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

  return NextResponse.json(quotation, { status: 201 });
});
