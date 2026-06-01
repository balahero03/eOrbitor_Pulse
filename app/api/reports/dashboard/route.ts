import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const teamFilter: any = {};
  if (user.role === 'SALES_MANAGER') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    teamFilter.assignedToId = { in: teamIds };
  }

  const [totalLeads, totalCustomers, activeDeals, openTickets, overdueTasks, pipelineByStage] = await Promise.all([
    prisma.lead.count({ where: { ...teamFilter, deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.deal.count({ where: { ...teamFilter, stage: { notIn: ['CLOSURE', 'ONGOING'] } } }),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { ...teamFilter, status: { not: 'COMPLETED' }, dueDate: { lt: new Date() } } }),
    prisma.deal.groupBy({
      by: ['stage'],
      where: teamFilter,
      _sum: { dealValue: true },
      _count: { id: true },
    }).catch(() => []),
  ]);

  return NextResponse.json({
    role: user.role,
    kpis: { totalLeads, totalCustomers, activeDeals, openTickets, overdueTasks },
    pipeline: (pipelineByStage as any[]).map((s) => ({
      stage: s.stage,
      value: s._sum?.dealValue || 0,
      count: s._count?.id || 0,
    })),
  });
});
