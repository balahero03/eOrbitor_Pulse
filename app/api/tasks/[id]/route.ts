import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Viewing stays scoped like the /api/tasks list route (assignee, creator,
// their manager, or an admin) — an assignee can still see their own task.
async function inScope(user: AuthUser, assignedToId: string, createdById: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.id === assignedToId || user.id === createdById) return true;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId) || teamIds.includes(createdById);
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      relatedDeal: { select: { id: true, dealName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!task) throw new NotFoundError('Task');
  if (!(await inScope(user, task.assignedToId, task.createdById))) throw new ForbiddenError();

  return NextResponse.json(task);
});

const OPEN_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'];

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true } });
  if (!existing) throw new NotFoundError('Task');

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const isAssignee = user.id === existing.assignedToId;
  const isCreator = user.id === existing.createdById;

  const body = await req.json();
  const { title, description, status, priority, dueDate, assignedToId, relatedDealId, tags, completedAt } = body;

  // A pure status change (nothing else in the body) is self-service: the
  // assignee can move their own task between the open states, and only the
  // creator can cancel it. Anything beyond just `status` — retitling,
  // reassigning, changing priority/due date — stays admin-only.
  const otherFields = [title, description, priority, dueDate, assignedToId, relatedDealId, tags, completedAt];
  const isPureStatusChange = status !== undefined && otherFields.every((f) => f === undefined);

  if (!isAdmin) {
    if (!isPureStatusChange) {
      throw new ForbiddenError('Only an admin can edit a task.');
    }
    if (status === 'CANCELLED') {
      if (!isCreator) throw new ForbiddenError('Only the task creator can cancel it.');
    } else if (OPEN_STATUSES.includes(status)) {
      if (!isAssignee) throw new ForbiddenError('Only the assignee can update this task\'s status.');
    } else {
      throw new ForbiddenError('Invalid status.');
    }
  }

  // Stamp/clear completedAt automatically off the status transition unless
  // the caller explicitly passed their own completedAt.
  const derivedCompletedAt =
    completedAt !== undefined
      ? (completedAt ? new Date(completedAt) : null)
      : status === 'COMPLETED'
      ? new Date()
      : status !== undefined
      ? null
      : undefined;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(assignedToId !== undefined && { assignedToId }),
      ...(relatedDealId !== undefined && { relatedDealId: relatedDealId || null }),
      ...(tags !== undefined && { tags }),
      ...(derivedCompletedAt !== undefined && { completedAt: derivedCompletedAt }),
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      relatedDeal: { select: { id: true, dealName: true } },
    },
  });

  return NextResponse.json(task);
});

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenError('Only an admin can delete a task.');

  const existing = await prisma.task.findUnique({ where: { id }, select: { assignedToId: true, createdById: true } });
  if (!existing) throw new NotFoundError('Task');

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ message: 'Task deleted' });
});
