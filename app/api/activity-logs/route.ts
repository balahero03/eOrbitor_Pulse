import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const entityType = searchParams.get('entityType');
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');

  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (userId) where.userId = userId;

  // Managers only see their team's logs
  if (user.role === 'SALES_MANAGER') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.userId = { in: teamIds };
  }

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { action, entityType, entityId, changes } = await req.json();

  if (!action || !entityType || !entityId) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const log = await prisma.activityLog.create({
    data: { userId: user.id, action, entityType, entityId, changes: changes || null },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json(log, { status: 201 });
});
