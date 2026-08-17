import { NextRequest, NextResponse } from 'next/server';
import { parseEnumParam, sanitizeSearch, parseDateInput } from '@/lib/queryFilters';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { sanitizeRichText } from '@/lib/sanitizeHtml';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { createNotification } from '@/lib/notify';
import { ForbiddenError } from '@/lib/errors';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// Who may hand a task to whom: admins to anyone; a manager to themselves or
// their own direct reports; an individual contributor to themselves only.
async function canAssign(user: AuthUser, assignedToId: string): Promise<boolean> {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (assignedToId === user.id) return true;
  if (user.role === 'BACKEND_TEAM') {
    const target = await prisma.user.findUnique({ where: { id: assignedToId }, select: { managerId: true } });
    return target?.managerId === user.id;
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = parseEnumParam(searchParams.get('status'), TaskStatus, 'task status');
  const priority = parseEnumParam(searchParams.get('priority'), TaskPriority, 'task priority');
  const assignedToId = searchParams.get('assignedToId');
  const search = sanitizeSearch(searchParams.get('search'));

  const where: any = {};

  // Role-based scoping
  let teamIds: string[] | null = null;
  if (user.role === 'ON_FIELD_TEAM') {
    where.assignedToId = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.assignedToId = { in: teamIds };
  }
  // ADMIN/SUPER_ADMIN see all

  if (status) where.status = status;
  if (priority) where.priority = priority;
  // The assignedToId filter overwrites the team scope set above, so it has to
  // be validated rather than just role-gated: a manager passing an id from
  // outside their own reports would otherwise replace their scope with someone
  // else's and read another team's tasks. Admins may filter to anyone;
  // on-field users stay pinned to themselves and the param is ignored.
  if (assignedToId) {
    if (ADMIN_ROLES.includes(user.role)) {
      where.assignedToId = assignedToId;
    } else if (user.role === 'BACKEND_TEAM') {
      if (!teamIds!.includes(assignedToId)) {
        throw new ForbiddenError('You can only filter tasks within your own team.');
      }
      where.assignedToId = assignedToId;
    }
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        relatedDeal: { select: { id: true, dealName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return NextResponse.json({
    tasks,
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { title, description, status, priority, dueDate, assignedToId, relatedDealId, tags } = await req.json();

  if (!title || !assignedToId) {
    return NextResponse.json({ message: 'Title and assignedToId are required' }, { status: 400 });
  }

  if (!(await canAssign(user, assignedToId))) {
    throw new ForbiddenError('You can only assign tasks to yourself or your direct reports.');
  }

  const task = await prisma.task.create({
    data: {
      title,
      // Rendered later with dangerouslySetInnerHTML — see lib/sanitizeHtml.ts.
      description: sanitizeRichText(description) || null,
      status: status || 'TODO',
      priority: priority || 'MEDIUM',
      dueDate: parseDateInput(dueDate, 'due date') ?? null,
      assignedToId,
      relatedDealId: relatedDealId || null,
      createdById: user.id,
      tags: tags || [],
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      relatedDeal: { select: { id: true, dealName: true } },
    },
  });

  // Notify assignee if different from creator
  if (assignedToId !== user.id) {
    const dueLabel = task.dueDate
      ? ` Due: ${new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
      : '';
    await createNotification(
      assignedToId,
      'TASK_ASSIGNED',
      'New Task Assigned',
      `You have been assigned "${title}".${dueLabel}`,
      'TASK',
      task.id,
    );
  }

  return NextResponse.json(task, { status: 201 });
});
