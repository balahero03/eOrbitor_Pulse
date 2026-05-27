import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { role, id: userId } = decoded;

    // ── SALES EXEC: personal daily dashboard ──────────────────────────
    if (role === 'SALES_EXEC') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [
        myLeads,
        myLeadsTotal,
        followUpsToday,
        overdueFollowUps,
        myOpenTasks,
        myOverdueTasks,
        tasksToday,
        recentLeads,
        upcomingFollowUps,
        leadsByStatus,
        wonThisMonth,
      ] = await Promise.all([
        // My leads counts
        prisma.lead.count({ where: { assignedToId: userId, deletedAt: null } }),
        prisma.lead.count({ where: { assignedToId: userId, deletedAt: null } }),

        // Follow-ups scheduled for today (on leads assigned to me)
        prisma.lead.findMany({
          where: {
            assignedToId: userId,
            deletedAt: null,
            followUpDate: { gte: today, lte: todayEnd },
          },
          select: { id: true, name: true, company: true, status: true, followUpDate: true, quoteNo: true },
          orderBy: { followUpDate: 'asc' },
        }),

        // Overdue follow-ups (past date, not won/lost/dropped)
        prisma.lead.findMany({
          where: {
            assignedToId: userId,
            deletedAt: null,
            followUpDate: { lt: today },
            status: { notIn: ['WON', 'LOST', 'DROPPED', 'REJECTED', 'CONVERTED'] },
          },
          select: { id: true, name: true, company: true, status: true, followUpDate: true, quoteNo: true },
          orderBy: { followUpDate: 'asc' },
          take: 10,
        }),

        // Open tasks assigned to me
        prisma.task.count({
          where: { assignedToId: userId, status: { not: 'COMPLETED' } },
        }),

        // Overdue tasks
        prisma.task.count({
          where: { assignedToId: userId, status: { not: 'COMPLETED' }, dueDate: { lt: today } },
        }),

        // Tasks due today
        prisma.task.findMany({
          where: {
            assignedToId: userId,
            status: { not: 'COMPLETED' },
            dueDate: { gte: today, lte: todayEnd },
          },
          select: { id: true, title: true, priority: true, dueDate: true, status: true },
          orderBy: { priority: 'asc' },
        }),

        // My 5 most recently updated leads
        prisma.lead.findMany({
          where: { assignedToId: userId, deletedAt: null },
          select: { id: true, name: true, company: true, status: true, quoteNo: true, quoteValue: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),

        // Upcoming follow-ups (next 7 days, not today)
        prisma.lead.findMany({
          where: {
            assignedToId: userId,
            deletedAt: null,
            followUpDate: {
              gt: todayEnd,
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
          select: { id: true, name: true, company: true, status: true, followUpDate: true, quoteNo: true },
          orderBy: { followUpDate: 'asc' },
          take: 8,
        }),

        // My leads by status
        prisma.lead.groupBy({
          by: ['status'],
          where: { assignedToId: userId, deletedAt: null },
          _count: true,
        }),

        // Leads won this month
        prisma.lead.count({
          where: {
            assignedToId: userId,
            status: 'WON',
            updatedAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

      return NextResponse.json({
        role: 'SALES_EXEC',
        today: today.toISOString(),
        stats: {
          myLeadsTotal,
          openTasks: myOpenTasks,
          overdueTasks: myOverdueTasks,
          followUpsToday: followUpsToday.length,
          overdueFollowUps: overdueFollowUps.length,
          wonThisMonth,
        },
        followUpsToday,
        overdueFollowUps,
        tasksToday,
        recentLeads,
        upcomingFollowUps,
        leadsByStatus,
      });
    }

    // ── ADMIN / MANAGER: org-level KPIs ───────────────────────────────
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    let leadWhere: any = { deletedAt: null };
    if (role === 'SALES_MANAGER') {
      const subs = await prisma.user.findMany({ where: { managerId: userId }, select: { id: true } });
      const teamIds = [userId, ...subs.map((u: any) => u.id)];
      leadWhere.assignedToId = { in: teamIds };
    }

    const [totalLeads, totalCustomers, activeDeals, openTickets, overdueTasks, pipelineByStage] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.deal.count({ where: { stage: { notIn: ['CLOSURE', 'LOST'] } } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.task.count({ where: { status: { not: 'COMPLETED' }, dueDate: { lt: new Date() } } }),
      prisma.deal.groupBy({ by: ['stage'], _sum: { dealValue: true }, _count: true }),
    ]);

    return NextResponse.json({
      role,
      kpis: { totalLeads, totalCustomers, activeDeals, openTickets, overdueTasks },
      pipeline: pipelineByStage.map(s => ({
        stage: s.stage,
        value: s._sum.dealValue || 0,
        count: s._count,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
