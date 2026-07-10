import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { id: userId, role } = user;

  // ── SUPPORT / VIEWER: tasks + announcements only ────────────────────
  if (role === 'SUPPORT' || role === 'VIEWER') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [myOpenTasks, myOverdueTasks, tasksToday, upcomingTasks, announcements] = await Promise.all([
      prisma.task.count({ where: { assignedToId: userId, status: { not: 'COMPLETED' } } }),
      prisma.task.count({ where: { assignedToId: userId, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
      prisma.task.findMany({
        where: { assignedToId: userId, status: { not: 'COMPLETED' }, dueDate: { gte: today, lte: todayEnd } },
        select: { id: true, title: true, priority: true, dueDate: true, status: true, description: true },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: { not: 'COMPLETED' },
          OR: [{ dueDate: { gt: todayEnd } }, { dueDate: null }],
        },
        select: { id: true, title: true, priority: true, dueDate: true, status: true, description: true },
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }],
        take: 10,
      }),
      prisma.announcement.findMany({
        where: { isPublished: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
        select: { id: true, title: true, content: true, priority: true, publishedAt: true },
      }),
    ]);

    return NextResponse.json({
      role,
      today: today.toISOString(),
      stats: { openTasks: myOpenTasks, overdueTasks: myOverdueTasks },
      tasksToday,
      upcomingTasks,
      announcements,
    });
  }

  // ── ON FIELD TEAM: personal daily dashboard ────────────────────────────
  if (role === 'ON_FIELD_TEAM') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
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
      prisma.lead.count({ where: { assignedToId: userId, deletedAt: null } }),
      prisma.lead.findMany({
        where: { assignedToId: userId, deletedAt: null, followUpDate: { gte: today, lte: todayEnd } },
        select: { id: true, name: true, company: true, status: true, followUpDate: true, quoteNo: true },
        orderBy: { followUpDate: 'asc' },
      }),
      prisma.lead.findMany({
        where: {
          assignedToId: userId, deletedAt: null,
          followUpDate: { lt: today },
          status: { notIn: ['WON', 'LOST', 'DROPPED', 'REJECTED', 'CONVERTED'] },
        },
        select: { id: true, name: true, company: true, status: true, followUpDate: true, quoteNo: true },
        orderBy: { followUpDate: 'asc' },
        take: 10,
      }),
      prisma.task.count({ where: { assignedToId: userId, status: { not: 'COMPLETED' } } }),
      prisma.task.count({ where: { assignedToId: userId, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
      prisma.task.findMany({
        where: { assignedToId: userId, status: { not: 'COMPLETED' }, dueDate: { gte: today, lte: todayEnd } },
        select: { id: true, title: true, priority: true, dueDate: true, status: true },
        orderBy: { priority: 'asc' },
      }),
      prisma.lead.findMany({
        where: { assignedToId: userId, deletedAt: null },
        select: { id: true, name: true, company: true, status: true, quoteNo: true, quoteValue: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      prisma.lead.findMany({
        where: {
          assignedToId: userId, deletedAt: null,
          followUpDate: { gt: todayEnd, lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, name: true, company: true, status: true, followUpDate: true, quoteNo: true },
        orderBy: { followUpDate: 'asc' },
        take: 8,
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { assignedToId: userId, deletedAt: null },
        _count: true,
      }),
      prisma.lead.count({
        where: {
          assignedToId: userId, status: 'WON',
          updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    const announcements = await prisma.announcement.findMany({
      where: { isPublished: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
      select: { id: true, title: true, content: true, priority: true, publishedAt: true, expiresAt: true },
    });

    return NextResponse.json({
      role: 'ON_FIELD_TEAM',
      today: today.toISOString(),
      stats: {
        myLeadsTotal, openTasks: myOpenTasks, overdueTasks: myOverdueTasks,
        followUpsToday: followUpsToday.length, overdueFollowUps: overdueFollowUps.length, wonThisMonth,
      },
      followUpsToday, overdueFollowUps, tasksToday, recentLeads, upcomingFollowUps, leadsByStatus,
      announcements,
    });
  }

  // ── BACKEND TEAM: team-level metrics ───────────────────────────────
  if (role === 'BACKEND_TEAM') {
    const subs = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true, firstName: true, lastName: true },
    });
    const teamIds = [userId, ...subs.map((u) => u.id)];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      teamLeads, teamDeals, teamWonThisMonth,
      teamOpenTasks, teamOverdueTasks, teamFollowUpsOverdue,
      pipelineByStage, recentLeads,
    ] = await Promise.all([
      prisma.lead.count({
        where: {
          OR: [{ assignedToId: { in: teamIds } }, { broughtById: { in: teamIds } }],
          deletedAt: null,
        },
      }),
      prisma.deal.count({ where: { assignedToId: { in: teamIds }, stage: { notIn: ['CLOSURE', 'ONGOING'] } } }),
      prisma.lead.count({
        where: {
          assignedToId: { in: teamIds }, status: 'WON',
          updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.task.count({ where: { assignedToId: { in: teamIds }, status: { not: 'COMPLETED' } } }),
      prisma.task.count({ where: { assignedToId: { in: teamIds }, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
      prisma.lead.count({
        where: {
          assignedToId: { in: teamIds }, deletedAt: null,
          followUpDate: { lt: today },
          status: { notIn: ['WON', 'LOST', 'DROPPED', 'REJECTED', 'CONVERTED'] },
        },
      }),
      prisma.deal.groupBy({
        by: ['stage'],
        where: { assignedToId: { in: teamIds } },
        _sum: { dealValue: true },
        _count: { id: true },
      }).catch(() => []),
      prisma.lead.findMany({
        where: { assignedToId: { in: teamIds }, deletedAt: null },
        select: {
          id: true, name: true, company: true, status: true,
          assignedTo: { select: { firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const leaderboard = await Promise.all(
      subs.map(async (u) => {
        const [wonCount, leadCount, pipelineAgg] = await Promise.all([
          prisma.lead.count({
            where: {
              assignedToId: u.id, status: 'WON',
              updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
          }),
          prisma.lead.count({ where: { assignedToId: u.id, deletedAt: null } }),
          prisma.deal.aggregate({
            where: { assignedToId: u.id, stage: { notIn: ['CLOSURE', 'ONGOING'] } },
            _sum: { dealValue: true },
          }),
        ]);
        return {
          userId: u.id, name: `${u.firstName} ${u.lastName}`,
          wonThisMonth: wonCount, activeLeads: leadCount,
          pipelineValue: Number(pipelineAgg._sum.dealValue || 0),
        };
      })
    );

    const announcements = await prisma.announcement.findMany({
      where: { isPublished: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
      select: { id: true, title: true, content: true, priority: true, publishedAt: true, expiresAt: true },
    });

    return NextResponse.json({
      role: 'BACKEND_TEAM',
      teamName: `${subs.length + 1} member team`,
      stats: { teamLeads, teamDeals, teamWonThisMonth, teamOpenTasks, teamOverdueTasks, teamFollowUpsOverdue },
      teamMembers: subs.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
      leaderboard,
      pipeline: (pipelineByStage as any[]).map((s) => ({
        stage: s.stage, value: Number(s._sum?.dealValue || 0), count: s._count?.id || 0,
      })),
      recentLeads,
      announcements,
    });
  }

  // ── ADMIN / SUPER_ADMIN: org-level KPIs ─────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalLeads, totalCustomers, activeDeals, overdueTasks,
    pendingApprovals, totalUsers, monthRevenue, lastMonthRevenue, pipelineByStage, recentActivity,
  ] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.deal.count({ where: { stage: { notIn: ['CLOSURE', 'ONGOING'] } } }),
    prisma.task.count({ where: { status: { not: 'COMPLETED' }, dueDate: { lt: now } } }),
    prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'COMPLETED', createdAt: { gte: monthStart } }, _sum: { totalAmount: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'COMPLETED', createdAt: { gte: lastMonthStart, lt: monthStart } }, _sum: { totalAmount: true } }),
    prisma.deal.groupBy({ by: ['stage'], where: { stage: { notIn: ['CLOSURE', 'ONGOING'] } }, _sum: { dealValue: true }, _count: { id: true } }).catch(() => []),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, entityType: true, createdAt: true },
    }),
  ]);

  const dealsPipelineValue = await prisma.deal.aggregate({
    where: { stage: { notIn: ['CLOSURE', 'ONGOING'] } },
    _sum: { dealValue: true },
  });

  const announcements = await prisma.announcement.findMany({
    where: { isPublished: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
    take: 5,
    select: { id: true, title: true, content: true, priority: true, publishedAt: true, expiresAt: true },
  });

  return NextResponse.json({
    role: 'ADMIN',
    kpis: {
      totalLeads, totalCustomers, activeDeals,
      dealsPipelineValue: Number(dealsPipelineValue._sum.dealValue || 0),
      overdueTasks,
      monthRevenue: Number(monthRevenue._sum.totalAmount || 0),
      lastMonthRevenue: Number(lastMonthRevenue._sum.totalAmount || 0),
      totalUsers, pendingApprovals,
    },
    pipeline: (pipelineByStage as any[]).map((s) => ({
      stage: s.stage, value: Number(s._sum?.dealValue || 0), count: s._count?.id || 0,
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id, action: a.action, entity: a.entityType, createdAt: a.createdAt.toISOString(),
    })),
    announcements,
  });
});
