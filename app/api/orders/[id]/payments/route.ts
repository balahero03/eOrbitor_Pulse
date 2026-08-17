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

/**
 * Reject a payment that would take the order past its value.
 *
 * The tolerance absorbs the rounding of a Decimal round-tripped through a
 * JavaScript number; it is not slack for a genuine overpayment. Orders with no
 * value set (total 0) are exempt — the value has simply not been entered yet,
 * and the order page's own empty state points the user at setting it.
 */
function overpaymentGuard(total: number, alreadyPaid: number, value: number) {
  if (total > 0 && alreadyPaid + value > total + 0.001) {
    const remaining = Math.max(total - alreadyPaid, 0);
    throw new ValidationError(
      `That is more than the outstanding balance. ₹${remaining.toLocaleString('en-IN')} remains on this order.`
    );
  }
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const orderId = orderIdFrom(req);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, deletedAt: true, deal: { select: { assignedToId: true } } },
  });
  if (!order || order.deletedAt) throw new NotFoundError('Order');
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
      deletedAt: true,
      deal: { select: { assignedToId: true } },
    },
  });
  if (!order || order.deletedAt) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  // parseMoneyInput handles Indian grouping ("1,25,000") and rejects free text,
  // rather than parseFloat silently truncating at the first comma.
  const value = parseMoneyInput(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError('Enter a payment amount greater than zero.');
  }

  // Fast rejection on the cached figure, so the common "they typed too much"
  // case fails before anything is written to disk. This is not the authoritative
  // check — that one runs under a row lock inside the transaction below.
  overpaymentGuard(Number(order.totalAmount), Number(order.amountPaid), value);

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
    // Take an exclusive lock on the order row before reading the ledger.
    //
    // Without it, two payments submitted at the same moment each read the
    // balance before the other had committed, so each saw room for itself and
    // both were accepted. Reproduced against the running app: two concurrent
    // ₹8,000 payments on a ₹10,000 order both returned 201, leaving a ledger of
    // ₹16,000 against a ₹10,000 order.
    //
    // It also broke the invariant recomputeTotals exists to hold. Both
    // transactions aggregated the ledger without seeing each other's
    // uncommitted insert, so both computed ₹8,000 and both wrote it — the order
    // ended up showing "₹8,000 paid, ₹2,000 outstanding" while its own Payment
    // History listed two ₹8,000 rows. The screen then invited a third payment
    // against a balance that did not exist.
    //
    // FOR UPDATE serialises payments per order — the second waits for the first
    // to commit and then reads the true total — without imposing a serializable
    // isolation level on unrelated writes.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    const current = await tx.order.findUnique({
      where: { id: orderId },
      select: { totalAmount: true },
    });
    const ledger = await tx.orderPayment.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });
    // Re-derived from the ledger rather than from the cached amountPaid, so a
    // cached figure that has drifted for any reason cannot authorise a payment.
    overpaymentGuard(Number(current?.totalAmount ?? 0), Number(ledger._sum.amount ?? 0), value);

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
