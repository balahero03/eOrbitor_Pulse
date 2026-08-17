import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseEnumParam, parseDateInput } from '@/lib/queryFilters';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { createWithOrderNumber } from '@/lib/orderNumber';
import { parseMoneyInput } from '@/lib/money';
import { ValidationError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = parseEnumParam(searchParams.get('status'), OrderStatus, 'order status');
  const paymentStatus = parseEnumParam(searchParams.get('paymentStatus'), PaymentStatus, 'payment status');
  const search = sanitizeSearch(searchParams.get('search'));

  const where: any = { deletedAt: null };

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

  // Overdue is derived, never stored: a due date in the past and money still
  // owed. Storing a flag would mean something had to remember to clear it the
  // moment a payment landed, and it would be wrong for the rest of the day
  // whenever nothing ran.
  //
  // `paymentStatus in (PENDING, PARTIAL)` stands in for "money still owed"
  // because it is maintained from the ledger on every payment write, and
  // unlike `totalAmount > amountPaid` it is an indexed column.
  if (searchParams.get('overdue') === 'true') {
    where.paymentDueDate = { lt: new Date() };
    where.paymentStatus = { in: ['PENDING', 'PARTIAL'] };
  }
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
        paymentTerms: true, paymentDueDate: true,
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

  // parseFloat returned NaN for free text, and `NaN.toString()` is the string
  // "NaN", which reached the Decimal column and threw. parseMoneyInput also
  // understands Indian grouping ("1,25,000") rather than truncating at the
  // first comma the way parseFloat does.
  const totalAmt = parseMoneyInput(totalAmount);
  if (!Number.isFinite(totalAmt) || totalAmt < 0) {
    throw new ValidationError('Order value must be a non-negative number.');
  }
  const paidRaw = amountPaid === undefined || amountPaid === null || amountPaid === '' ? 0 : parseMoneyInput(amountPaid);
  if (!Number.isFinite(paidRaw) || paidRaw < 0) {
    throw new ValidationError('Amount paid must be a non-negative number.');
  }
  const paidAmt = paidRaw;
  if (totalAmt > 0 && paidAmt > totalAmt + 0.001) {
    throw new ValidationError('Amount paid cannot exceed the order value.');
  }

  // Validated once, then reused for both the order and its opening ledger row.
  const parsedPoDate = parseDateInput(poDate, 'PO date') ?? null;

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
          poDate: parsedPoDate,
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
            paidAt: parsedPoDate ?? new Date(),
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
