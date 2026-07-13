import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, dealAssignedToId: string | null | undefined): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return !!dealAssignedToId && dealAssignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!dealAssignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(dealAssignedToId);
  }
  return false;
}

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/payment')[0].split('/').pop()!;

  const body = await req.json();
  const { amountPaid } = body;

  if (amountPaid === undefined || amountPaid <= 0) {
    throw new ValidationError('Valid amount must be provided');
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { deal: { select: { assignedToId: true } } },
  });
  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  const currentAmountPaid = parseFloat(order.amountPaid.toString());
  const totalAmount = parseFloat(order.totalAmount.toString());
  const newAmountPaid = currentAmountPaid + amountPaid;

  // A payment can never push the running total past what the order is worth
  // — without this cap the ledger could show more money collected than billed.
  if (newAmountPaid > totalAmount) {
    throw new ValidationError(
      `This payment would bring the total paid to ${newAmountPaid}, which exceeds the order total of ${totalAmount}.`
    );
  }

  let paymentStatus = 'PENDING';
  if (newAmountPaid >= totalAmount) {
    paymentStatus = 'COMPLETED';
  } else if (newAmountPaid > 0) {
    paymentStatus = 'PARTIAL';
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      amountPaid: newAmountPaid.toString(),
      paymentStatus: paymentStatus as any,
    },
    include: {
      customer: { select: { companyName: true } },
    },
  });

  return NextResponse.json(updated);
});
