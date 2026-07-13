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
  const id = req.nextUrl.pathname.split('/fulfill')[0].split('/').pop()!;

  const body = await req.json();
  const { deliveryDate } = body;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { deal: { select: { assignedToId: true } } },
  });
  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  if (order.status !== 'CONFIRMED') {
    throw new ValidationError('Only confirmed orders can be fulfilled');
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: 'FULFILLED',
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
    },
    include: {
      customer: { select: { companyName: true } },
    },
  });

  return NextResponse.json(updated);
});
