import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();

  const teamFilter: any = {};
  if (user.role === 'SALES_MANAGER') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    teamFilter.assignedToId = { in: teamIds };
  }

  const [dealsByStage, totalPipelineValue, totalDeals] = await Promise.all([
    prisma.deal.groupBy({
      by: ['stage'],
      where: teamFilter,
      _count: { id: true },
      _sum: { dealValue: true },
    }),
    prisma.deal.aggregate({ where: teamFilter, _sum: { dealValue: true } }),
    prisma.deal.count({ where: teamFilter }),
  ]);

  const wonDeals = await prisma.deal.findMany({
    where: { ...teamFilter, stage: 'CLOSURE', closedAt: { gte: startDate, lte: endDate } },
  });
  const lostDeals = await prisma.deal.findMany({
    where: { ...teamFilter, lostReason: { not: null }, updatedAt: { gte: startDate, lte: endDate } },
  });

  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.dealValue), 0);
  const lostValue = lostDeals.reduce((sum, d) => sum + Number(d.dealValue), 0);
  const winRate = totalDeals > 0 ? ((wonDeals.length / totalDeals) * 100).toFixed(2) : '0';

  const completedOrders = await prisma.order.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
  });
  const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return NextResponse.json({
    period: { startDate, endDate },
    pipeline: {
      totalValue: totalPipelineValue._sum.dealValue || 0,
      byStage: dealsByStage.map((s) => ({
        stage: s.stage,
        count: s._count.id,
        value: s._sum.dealValue || 0,
      })),
    },
    deals: {
      total: totalDeals,
      won: wonDeals.length,
      lost: lostDeals.length,
      active: totalDeals - wonDeals.length - lostDeals.length,
      wonValue, lostValue,
      winRate: parseFloat(winRate),
    },
    revenue: {
      completed: totalRevenue,
      ordersCount: completedOrders.length,
      averageOrderValue: completedOrders.length > 0 ? (totalRevenue / completedOrders.length).toFixed(2) : 0,
    },
  });
});
