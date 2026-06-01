import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const where: any = {};

  // Role-based scoping: SALES_EXEC sees only their own quotations
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
        id: true, quotationNumber: true, status: true,
        customer: { select: { id: true, companyName: true } },
        deal: { select: { dealName: true } },
        subtotal: true, taxAmount: true, totalAmount: true,
        issueDate: true, expiryDate: true,
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
  const { dealId, customerId, items, notes } = await req.json();

  if (!dealId || !customerId || !items || items.length === 0) {
    return NextResponse.json(
      { message: 'dealId, customerId, and items are required' },
      { status: 400 }
    );
  }

  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) {
      return NextResponse.json({ message: `Product ${item.productId} not found` }, { status: 404 });
    }
    const lineSubtotal = item.quantity * item.unitPrice;
    subtotal += lineSubtotal;
    taxAmount += lineSubtotal * (Number(product.tax) / 100);
  }

  const totalAmount = subtotal + taxAmount;
  const count = await prisma.quotation.count();
  const quotationNumber = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber, dealId, customerId,
      status: 'DRAFT',
      items,
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: '0',
      totalAmount: totalAmount.toString(),
      issueDate: new Date(),
      notes,
      createdById: user.id,
    },
    include: {
      customer: { select: { companyName: true } },
      deal: { select: { dealName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(quotation, { status: 201 });
});
