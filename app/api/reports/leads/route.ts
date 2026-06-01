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

  // Managers only see their team's data
  const teamFilter: any = {};
  if (user.role === 'SALES_MANAGER') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    teamFilter.assignedToId = { in: teamIds };
  }

  const [leadsBySource, leadsByStatus, totalLeads, convertedLeads, newLeads, avgLeadScore] = await Promise.all([
    prisma.lead.groupBy({ by: ['source'], where: teamFilter, _count: { id: true } }),
    prisma.lead.groupBy({ by: ['status'], where: teamFilter, _count: { id: true } }),
    prisma.lead.count({ where: teamFilter }),
    prisma.lead.count({ where: { ...teamFilter, status: 'CONVERTED' } }),
    prisma.lead.count({ where: { ...teamFilter, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.lead.aggregate({ where: teamFilter, _avg: { leadScore: true } }),
  ]);

  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : '0';

  return NextResponse.json({
    period: { startDate, endDate },
    summary: {
      total: totalLeads,
      converted: convertedLeads,
      newThisPeriod: newLeads,
      conversionRate: parseFloat(conversionRate),
      averageScore: parseFloat(avgLeadScore._avg.leadScore?.toFixed(2) || '0'),
    },
    bySource: leadsBySource.map((s) => ({ source: s.source, count: s._count.id })),
    byStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count.id })),
  });
});
