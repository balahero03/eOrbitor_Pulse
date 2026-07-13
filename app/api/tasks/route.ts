import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const assignedToId = searchParams.get('assignedToId');
  const search = searchParams.get('search');

  const where: any = {};

  // Role-based scoping
  if (user.role === 'ON_FIELD_TEAM') {
    where.assignedToId = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.assignedToId = { in: teamIds };
  }
  // ADMIN/SUPER_ADMIN see all

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedToId && ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role)) {
    where.assignedToId = assignedToId;
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
      orderBy: { dueDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return NextResponse.json({
    tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
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
      description: description || null,
      status: status || 'TODO',
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
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
