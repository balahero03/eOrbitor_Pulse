import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const outcome = searchParams.get('outcome'); // WON | LOST | DROPPED | ORDER
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const closedStatuses = outcome
    ? [outcome]
    : ['WON', 'LOST', 'DROPPED', 'ORDER'];

  const where: any = {
    deletedAt: null,
    status: { in: closedStatuses },
  };

  // Role scoping
  if (user.role === 'SALES_EXEC') {
    where.assignedToId = user.id;
  } else if (user.role === 'SALES_MANAGER') {
    const team = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    where.assignedToId = { in: [user.id, ...team.map(u => u.id)] };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (from || to) {
    where.closedAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to + 'T23:59:59') }),
    };
  }

  const skip = (page - 1) * limit;

  const [leads, total, stats] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, name: true, company: true, status: true,
        quoteValue: true, quoteNo: true, source: true,
        closedAt: (true as any),
        closureReason: (true as any),
        assignedTo: { select: { firstName: true, lastName: true } },
        createdAt: true, updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.lead.count({ where }),
    // Summary stats for all closed leads (ignoring current filter)
    prisma.lead.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        status: { in: ['WON', 'LOST', 'DROPPED', 'ORDER'] },
        ...(user.role === 'SALES_EXEC' ? { assignedToId: user.id } : {}),
      },
      _count: { id: true },
      _sum: { quoteValue: true },
    }),
  ]);

  const statsMap: Record<string, { count: number; value: number }> = {};
  for (const s of stats) {
    statsMap[s.status] = {
      count: s._count.id,
      value: Number(s._sum.quoteValue || 0),
    };
  }

  return NextResponse.json({
    leads,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats: {
      won: statsMap['WON'] || { count: 0, value: 0 },
      lost: statsMap['LOST'] || { count: 0, value: 0 },
      dropped: statsMap['DROPPED'] || { count: 0, value: 0 },
      order: statsMap['ORDER'] || { count: 0, value: 0 },
    },
  });
});
