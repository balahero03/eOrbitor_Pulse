import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');
  const search = searchParams.get('search');

  const where: any = {};

  // Role-based scoping via linked deal's assignedTo
  if (user.role === 'ON_FIELD_TEAM') {
    where.deal = { assignedToId: user.id };
  } else if (user.role === 'BACKEND_TEAM') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.deal = { assignedToId: { in: teamIds } };
  }

  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, orderNumber: true, poNumber: true, status: true, paymentStatus: true,
        customer: { select: { id: true, companyName: true } },
        quotation: { select: { quotationNumber: true } },
        totalAmount: true, amountPaid: true, poDate: true, deliveryDate: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { quotationId, customerId, dealId, poNumber, poDate, totalAmount, paymentMode, paymentRemarks, paymentProofUrl, amountPaid } = await req.json();

  if (!customerId || !totalAmount) {
    return NextResponse.json({ message: 'customerId and totalAmount are required' }, { status: 400 });
  }

  const count = await prisma.order.count();
  const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const paidAmt = parseFloat(amountPaid) || 0;
  const totalAmt = parseFloat(totalAmount);
  const paymentStatus = paidAmt >= totalAmt && paidAmt > 0 ? 'COMPLETED' : paidAmt > 0 ? 'PARTIAL' : 'PENDING';

  const order = await prisma.order.create({
    data: {
      orderNumber,
      quotationId: quotationId || null,
      customerId,
      dealId: dealId || null,
      poNumber: poNumber || null,
      poDate: poDate ? new Date(poDate) : null,
      status: 'PENDING',
      paymentStatus,
      totalAmount: totalAmt.toString(),
      amountPaid: paidAmt.toString(),
      paymentMode: paymentMode || null,
      paymentRemarks: paymentRemarks || null,
      paymentProofUrl: paymentProofUrl || null,
    },
    include: {
      customer: { select: { companyName: true } },
      quotation: { select: { quotationNumber: true } },
      deal: { select: { dealName: true } },
    },
  });

  return NextResponse.json(order, { status: 201 });
});
