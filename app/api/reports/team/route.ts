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

  // Managers only see their team
  const userWhere: any = { role: { in: ['SALES_MANAGER', 'SALES_EXEC'] } };
  if (user.role === 'SALES_MANAGER') {
    userWhere.managerId = user.id;
  }

  const salesUsers = await prisma.user.findMany({ where: userWhere });

  const teamMetrics = await Promise.all(
    salesUsers.map(async (u) => {
      const [dealsAssigned, dealsWon, dealValue, leadsAssigned, leadsConverted, tasksCompleted] = await Promise.all([
        prisma.deal.count({ where: { assignedToId: u.id } }),
        prisma.deal.count({ where: { assignedToId: u.id, stage: 'CLOSURE', closedAt: { gte: startDate, lte: endDate } } }),
        prisma.deal.aggregate({ where: { assignedToId: u.id, stage: 'CLOSURE' }, _sum: { dealValue: true } }),
        prisma.lead.count({ where: { assignedToId: u.id } }),
        prisma.lead.count({ where: { assignedToId: u.id, status: 'CONVERTED' } }),
        prisma.task.count({ where: { assignedToId: u.id, status: 'COMPLETED', completedAt: { gte: startDate, lte: endDate } } }),
      ]);

      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        dealsAssigned, dealsWon,
        dealValue: dealValue._sum.dealValue || 0,
        leadsAssigned, leadsConverted,
        conversionRate: leadsAssigned > 0 ? ((leadsConverted / leadsAssigned) * 100).toFixed(2) : '0',
        tasksCompleted,
      };
    })
  );

  return NextResponse.json({ period: { startDate, endDate }, team: teamMetrics });
});
