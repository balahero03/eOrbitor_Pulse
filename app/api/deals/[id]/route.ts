import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Mirrors the /api/deals list route's role scoping (by assignedToId).
async function inScope(user: AuthUser, assignedToId: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return assignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId);
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { firstName: true, lastName: true } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!deal) throw new NotFoundError('Deal');
  if (!(await inScope(user, deal.assignedToId))) throw new ForbiddenError();

  return NextResponse.json(deal);
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.deal.findUnique({ where: { id }, select: { assignedToId: true } });
  if (!existing) throw new NotFoundError('Deal');
  if (!(await inScope(user, existing.assignedToId))) throw new ForbiddenError();

  const body = await req.json();
  const { dealName, stage, dealValue, winProbability, expectedCloseDate, nextAction, lostReason } = body;

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(dealName && { dealName }),
      ...(stage && { stage }),
      ...(dealValue !== undefined && { dealValue }),
      ...(winProbability !== undefined && { winProbability }),
      ...(expectedCloseDate && { expectedCloseDate: new Date(expectedCloseDate) }),
      ...(nextAction !== undefined && { nextAction }),
      ...(lostReason !== undefined && { lostReason }),
      ...(stage === 'CLOSURE' || stage === 'ONGOING' ? { closedAt: new Date() } : {}),
    },
  });

  return NextResponse.json(deal);
});

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.deal.findUnique({ where: { id }, select: { assignedToId: true } });
  if (!existing) throw new NotFoundError('Deal');
  // Deleting is a manager/admin action — deal ownership alone isn't enough,
  // matching how leads/orders restrict deletion above the individual-contributor level.
  if (!['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role) || !(await inScope(user, existing.assignedToId))) {
    throw new ForbiddenError();
  }

  await prisma.deal.delete({ where: { id } });

  return NextResponse.json({ message: 'Deal deleted successfully' });
});
