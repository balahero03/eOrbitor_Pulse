import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/complete')[0].split('/').pop()!;

  const existing = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true } });
  if (!existing) throw new NotFoundError('Task');

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const isAssignee = user.id === existing.assignedToId;
  if (!isAdmin && !isAssignee) throw new ForbiddenError('Only the assignee can complete this task.');

  const task = await prisma.task.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      relatedDeal: { select: { id: true, dealName: true } },
    },
  });

  return NextResponse.json(task);
});
