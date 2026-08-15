import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { createWithOrderNumber } from '@/lib/orderNumber';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');
  const search = searchParams.get('search')?.trim();

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
      { poNumber: { contains: search, mode: 'insensitive' } },
      { customer: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

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
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { quotationId, customerId, dealId, poNumber, poDate, totalAmount, paymentMode, paymentRemarks, paymentProofUrl, amountPaid } = await req.json();

  if (!customerId || !totalAmount) {
    return NextResponse.json({ message: 'customerId and totalAmount are required' }, { status: 400 });
  }

  const paidAmt = parseFloat(amountPaid) || 0;
  const totalAmt = parseFloat(totalAmount);
  const paymentStatus = paidAmt >= totalAmt && paidAmt > 0 ? 'COMPLETED' : paidAmt > 0 ? 'PARTIAL' : 'PENDING';

  const order = await createWithOrderNumber((orderNumber) =>
    prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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

      // Money taken at creation has to enter the ledger too. `Order.amountPaid`
      // is a cached sum of OrderPayment rows, recomputed from scratch on every
      // payment — so an opening amount recorded only on the Order was erased
      // the moment a second payment was recorded, because the recompute could
      // only see the rows it knew about.
      if (paidAmt > 0) {
        await tx.orderPayment.create({
          data: {
            orderId: created.id,
            amount: paidAmt.toString(),
            paidAt: poDate ? new Date(poDate) : new Date(),
            mode: paymentMode || null,
            remarks: paymentRemarks || 'Recorded when the order was created.',
            recordedById: user.id,
          },
        });
      }

      return created;
    })
  );

  return NextResponse.json(order, { status: 201 });
});
