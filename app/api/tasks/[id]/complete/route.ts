import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, assignedToId: string, createdById: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.id === assignedToId || user.id === createdById) return true;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId) || teamIds.includes(createdById);
  }
  return false;
}

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/complete')[0].split('/').pop()!;

  const existing = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true } });
  if (!existing) throw new NotFoundError('Task');
  if (!(await inScope(user, existing.assignedToId, existing.createdById))) throw new ForbiddenError();

  const task = await prisma.task.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      relatedDeal: { select: { id: true, dealName: true } },
    },
  });

  return NextResponse.json(task);
});
