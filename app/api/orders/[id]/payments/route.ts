import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { saveBase64Files } from '@/lib/storage';
import { parseMoneyInput } from '@/lib/money';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, dealAssignedToId?: string | null): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return dealAssignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!dealAssignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(dealAssignedToId);
  }
  return false;
}

function orderIdFrom(req: NextRequest): string {
  // .../api/orders/<id>/payments
  const segments = req.nextUrl.pathname.split('/');
  return segments[segments.length - 2];
}

/**
 * Recompute the order's cached totals from its payment ledger.
 *
 * `Order.amountPaid` is denormalised so the list query can sort and filter on
 * it without joining. Deriving it from `sum(payments)` on every write — rather
 * than incrementing — means a deleted or corrected payment can never leave the
 * cached figure disagreeing with the rows that justify it.
 */
async function recomputeTotals(tx: any, orderId: string) {
  const agg = await tx.orderPayment.aggregate({
    where: { orderId },
    _sum: { amount: true },
  });
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { totalAmount: true },
  });
  const paid = Number(agg._sum.amount ?? 0);
  const total = Number(order?.totalAmount ?? 0);
  const paymentStatus = paid <= 0 ? 'PENDING' : paid >= total && total > 0 ? 'COMPLETED' : 'PARTIAL';

  await tx.order.update({
    where: { id: orderId },
    data: { amountPaid: paid.toString(), paymentStatus },
  });
  return { paid, total, paymentStatus };
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const orderId = orderIdFrom(req);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, deal: { select: { assignedToId: true } } },
  });
  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  const payments = await prisma.orderPayment.findMany({
    where: { orderId },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json({ payments });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const orderId = orderIdFrom(req);
  const body = await req.json();
  const { amount, paidAt, mode, reference, remarks, proofFile } = body;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalAmount: true,
      amountPaid: true,
      deal: { select: { assignedToId: true } },
    },
  });
  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  // parseMoneyInput handles Indian grouping ("1,25,000") and rejects free text,
  // rather than parseFloat silently truncating at the first comma.
  const value = parseMoneyInput(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError('Enter a payment amount greater than zero.');
  }

  const total = Number(order.totalAmount);
  const alreadyPaid = Number(order.amountPaid);
  if (total > 0 && alreadyPaid + value > total + 0.001) {
    const remaining = Math.max(total - alreadyPaid, 0);
    throw new ValidationError(
      `That is more than the outstanding balance. ₹${remaining.toLocaleString('en-IN')} remains on this order.`
    );
  }

  // The receipt goes to disk and only its descriptor is stored. Inlining the
  // base64 into Postgres (what this used to do) put a multi-megabyte string in
  // a column that rides along with every read of the row.
  let proof = null;
  if (proofFile?.dataBase64 && proofFile?.filename) {
    const [stored] = saveBase64Files(`orders/${orderId}`, [
      {
        filename: proofFile.filename,
        contentType: proofFile.contentType,
        dataBase64: proofFile.dataBase64,
      },
    ]);
    proof = stored ?? null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.orderPayment.create({
      data: {
        orderId,
        amount: value.toString(),
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        mode: mode || null,
        reference: reference?.trim() || null,
        remarks: remarks?.trim() || null,
        proof: proof as any,
        recordedById: user.id,
      },
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    const totals = await recomputeTotals(tx, orderId);

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'ORDER_PAYMENT',
        entityId: payment.id,
        changes: { orderId, amount: value, mode: mode || null, reference: reference || null },
      },
    });

    return { payment, totals };
  });

  return NextResponse.json(result, { status: 201 });
});
