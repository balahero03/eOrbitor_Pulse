import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PENDING';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  const where: any = { status };

  if (user.role === 'SALES_MANAGER') {
    const subordinates = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...subordinates.map((u) => u.id)];
    where.requestedByUser = { id: { in: teamIds } };
  }

  const skip = (page - 1) * limit;
  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedByUser: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, name: true, company: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return NextResponse.json({
    requests,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { entityId, type, reason } = await req.json();

  if (!entityId || !type) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const request = await prisma.approvalRequest.create({
    data: {
      type: type as any,
      entityType: 'LEAD',
      entityId,
      requestedBy: user.id,
      reason,
    },
    include: {
      requestedByUser: { select: { firstName: true, lastName: true } },
      lead: { select: { name: true, company: true } },
    },
  });

  return NextResponse.json(request, { status: 201 });
});
