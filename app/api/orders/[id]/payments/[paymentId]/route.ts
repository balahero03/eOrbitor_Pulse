import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Remove a wrongly-entered payment.
 *
 * Admin-only and deliberately hard to reach: a payment row is financial
 * evidence, so the safe correction for "wrong amount" is normally a second,
 * offsetting entry. This exists for the genuine mistake — a duplicate, or a
 * receipt filed against the wrong order — and is written to the audit log.
 */
export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const segments = req.nextUrl.pathname.split('/');
  const paymentId = segments[segments.length - 1];
  const orderId = segments[segments.length - 3];

  if (!ADMIN_ROLES.includes(user.role)) {
    throw new ForbiddenError('Only an admin can remove a recorded payment.');
  }

  const payment = await prisma.orderPayment.findFirst({
    where: { id: paymentId, orderId },
    select: { id: true, amount: true, mode: true, reference: true },
  });
  if (!payment) throw new NotFoundError('Payment');

  await prisma.$transaction(async (tx) => {
    await tx.orderPayment.delete({ where: { id: paymentId } });

    // Same derive-from-ledger rule as the create path.
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

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: 'DELETE',
        entityType: 'ORDER_PAYMENT',
        entityId: paymentId,
        // The row is gone; the log keeps what it said so the deletion is
        // reconcilable after the fact.
        changes: {
          orderId,
          amount: Number(payment.amount),
          mode: payment.mode,
          reference: payment.reference,
        },
      },
    });
  });

  // The stored proof file is intentionally left on disk: it is the evidence
  // that a receipt was filed, and orphaning it costs a few KB while deleting
  // it destroys the only copy.
  return NextResponse.json({ ok: true });
});
