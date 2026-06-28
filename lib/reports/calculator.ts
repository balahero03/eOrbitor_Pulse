import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

const WON_STATUSES = ['WON', 'ORDER'] as const;
const CLOSED_STATUSES = ['WON', 'ORDER', 'LOST', 'DROPPED'] as const;

function toNumber(val: Decimal | null | undefined): number {
  return val ? Number(val) : 0;
}

export class ReportCalculator {
  async getLeadMetrics(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    const base = { assignedToId: userId };
    const createdInRange = { createdAt: { gte: startDate, lte: endDate } };
    const closedInRange = { closedAt: { gte: startDate, lte: endDate } };

    const [total, closed, converted, byStatus, bySource] = await Promise.all([
      prisma.lead.count({ where: { ...base, ...createdInRange } }),
      prisma.lead.count({ where: { ...base, ...closedInRange, status: { in: [...CLOSED_STATUSES] } } }),
      prisma.lead.count({ where: { ...base, ...closedInRange, status: { in: [...WON_STATUSES] } } }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { ...base, ...createdInRange },
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { ...base, ...createdInRange },
        _count: true,
      }),
    ]);

    return {
      total,
      closed,
      converted,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      bySource: Object.fromEntries(bySource.map(s => [s.source, s._count])),
    };
  }

  async getRevenueMetrics(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    const closedInRange = { closedAt: { gte: startDate, lte: endDate } };

    const [wonAgg, pipelineAgg, wonLeads] = await Promise.all([
      prisma.lead.aggregate({
        where: { assignedToId: userId, ...closedInRange, status: { in: [...WON_STATUSES] } },
        _sum: { quoteValue: true },
        _avg: { quoteValue: true },
      }),
      prisma.deal.aggregate({
        where: { assignedToId: userId, createdAt: { gte: startDate, lte: endDate } },
        _sum: { dealValue: true },
      }),
      prisma.lead.findMany({
        where: { assignedToId: userId, ...closedInRange, status: { in: [...WON_STATUSES] } },
        select: { closedAt: true, quoteValue: true, source: true },
      }),
    ]);

    // Aggregate revenue by month
    const monthMap: Record<string, number> = {};
    for (const lead of wonLeads) {
      if (!lead.closedAt) continue;
      const key = lead.closedAt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthMap[key] = (monthMap[key] || 0) + toNumber(lead.quoteValue);
    }

    // Aggregate revenue by source
    const sourceMap: Record<string, number> = {};
    for (const lead of wonLeads) {
      sourceMap[lead.source] = (sourceMap[lead.source] || 0) + toNumber(lead.quoteValue);
    }

    return {
      total: toNumber(wonAgg._sum.quoteValue),
      pipeline: toNumber(pipelineAgg._sum.dealValue),
      average: toNumber(wonAgg._avg.quoteValue),
      byMonth: Object.entries(monthMap).map(([month, revenue]) => ({ month, revenue })),
      bySource: sourceMap,
    };
  }

  async getConversionMetrics(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    const createdInRange = { createdAt: { gte: startDate, lte: endDate } };

    const [allBySource, wonBySource, leadMetrics] = await Promise.all([
      prisma.lead.groupBy({
        by: ['source'],
        where: { assignedToId: userId, ...createdInRange },
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['source'],
        where: { assignedToId: userId, ...createdInRange, status: { in: [...WON_STATUSES] } },
        _count: true,
      }),
      this.getLeadMetrics(userId, dateRange),
    ]);

    const winRate = leadMetrics.closed > 0 ? (leadMetrics.converted / leadMetrics.closed) * 100 : 0;
    const conversionRate = leadMetrics.total > 0 ? (leadMetrics.converted / leadMetrics.total) * 100 : 0;

    const bySource: Record<string, { total: number; won: number; rate: number }> = {};
    for (const row of allBySource) {
      const won = wonBySource.find(w => w.source === row.source)?._count ?? 0;
      bySource[row.source] = {
        total: row._count,
        won,
        rate: row._count > 0 ? Math.round((won / row._count) * 1000) / 10 : 0,
      };
    }

    return {
      winRate: Math.round(winRate * 10) / 10,
      conversionRate: Math.round(conversionRate * 10) / 10,
      bySource,
    };
  }

  async getActivityMetrics(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;

    const [totalActivities, followupsCompleted, tasksCompleted] = await Promise.all([
      prisma.activityLog.count({
        where: { userId, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.followUp.count({
        where: {
          createdById: userId,
          actualDate: { gte: startDate, lte: endDate },
        },
      }),
      prisma.task.count({
        where: {
          assignedToId: userId,
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return { total: totalActivities, followupsCompleted, tasksCompleted };
  }

  async getSalesCycleMetrics(userId: string, dateRange: DateRange) {
    const closedLeads = await prisma.lead.findMany({
      where: {
        assignedToId: userId,
        closedAt: { gte: dateRange.startDate, lte: dateRange.endDate },
        status: { in: [...CLOSED_STATUSES] },
      },
      select: { createdAt: true, closedAt: true },
    });

    if (closedLeads.length === 0) return { avgDuration: 0, median: 0 };

    const durations = closedLeads
      .filter(l => l.closedAt)
      .map(l => Math.floor((l.closedAt!.getTime() - l.createdAt.getTime()) / 86400000));

    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return { avgDuration: avg, median };
  }

  async getTopDeals(userId: string, dateRange: DateRange, limit = 10) {
    const deals = await prisma.lead.findMany({
      where: {
        assignedToId: userId,
        closedAt: { gte: dateRange.startDate, lte: dateRange.endDate },
        status: { in: [...WON_STATUSES] },
      },
      select: { id: true, name: true, company: true, quoteValue: true, closedAt: true, status: true },
      orderBy: { quoteValue: 'desc' },
      take: limit,
    });

    return deals.map(d => ({
      id: d.id,
      dealName: `${d.company} — ${d.name}`,
      value: toNumber(d.quoteValue),
      closedDate: d.closedAt?.toLocaleDateString('en-IN') ?? 'N/A',
      status: d.status,
    }));
  }

  async getPerformanceScore(userId: string, dateRange: DateRange) {
    const [conversion, revenue, activities, leads] = await Promise.all([
      this.getConversionMetrics(userId, dateRange),
      this.getRevenueMetrics(userId, dateRange),
      this.getActivityMetrics(userId, dateRange),
      this.getLeadMetrics(userId, dateRange),
    ]);

    const winRateScore = Math.min((conversion.winRate / 100) * 30, 30);
    const revenueScore = Math.min((revenue.total / 5_000_000) * 40, 40);
    const activityScore = Math.min((activities.total / 500) * 20, 20);
    const leadScore = Math.min((leads.total / 150) * 10, 10);

    const total = winRateScore + revenueScore + activityScore + leadScore;

    return {
      score: Math.min(Math.round(total * 10) / 10, 100),
      breakdown: {
        winRate: Math.round(winRateScore * 10) / 10,
        revenue: Math.round(revenueScore * 10) / 10,
        activity: Math.round(activityScore * 10) / 10,
        leads: Math.round(leadScore * 10) / 10,
      },
    };
  }

  async getDailyActivityMetrics(userId: string, dateRange: DateRange) {
    const startStr = dateRange.startDate.toISOString().slice(0, 10);
    const endStr   = dateRange.endDate.toISOString().slice(0, 10);

    const records = await prisma.dailyActivity.findMany({
      where: { userId, date: { gte: startStr, lte: endStr } },
      select: { date: true, loginTime: true, logoutTime: true, totalHours: true, activities: true },
      orderBy: { date: 'asc' },
    });

    let totalLoggedHours = 0;
    let totalActivityMinutes = 0;
    let unproductiveDays = 0;
    const dailyBreakdown: {
      date: string;
      loggedHours: number;
      activityHours: number;
      unproductiveHours: number;
      activityCount: number;
    }[] = [];

    for (const rec of records) {
      const loggedHours = rec.totalHours ? Number(rec.totalHours) : 0;
      totalLoggedHours += loggedHours;

      let entries: any[] = [];
      try { entries = JSON.parse(rec.activities || '[]'); } catch { entries = []; }

      // Sum minutes covered by activity entries that have timeIn+timeOut
      let coveredMinutes = 0;
      for (const e of entries) {
        if (e.timeIn && e.timeOut) {
          const [h1, m1] = e.timeIn.split(':').map(Number);
          const [h2, m2] = e.timeOut.split(':').map(Number);
          const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (mins > 0) coveredMinutes += mins;
        }
      }

      totalActivityMinutes += coveredMinutes;
      const activityHours = Math.round((coveredMinutes / 60) * 100) / 100;
      const unproductiveHours = Math.max(0, Math.round((loggedHours - activityHours) * 100) / 100);
      if (unproductiveHours > 0.5) unproductiveDays++;

      dailyBreakdown.push({
        date: rec.date,
        loggedHours: Math.round(loggedHours * 100) / 100,
        activityHours,
        unproductiveHours,
        activityCount: entries.length,
      });
    }

    const totalUnproductiveHours = Math.max(
      0,
      Math.round((totalLoggedHours - totalActivityMinutes / 60) * 100) / 100
    );

    return {
      totalLoggedHours: Math.round(totalLoggedHours * 100) / 100,
      totalActivityHours: Math.round((totalActivityMinutes / 60) * 100) / 100,
      totalUnproductiveHours,
      unproductiveDays,
      daysPresent: records.length,
      dailyBreakdown,
    };
  }

  // Compare core metrics against the immediately preceding window of equal length.
  async getPeriodComparison(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    const spanMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs);
    const prevRange: DateRange = { startDate: prevStart, endDate: prevEnd };

    const [curLeads, curRevenue, curConv, curAct, prevLeads, prevRevenue, prevConv, prevAct] = await Promise.all([
      this.getLeadMetrics(userId, dateRange),
      this.getRevenueMetrics(userId, dateRange),
      this.getConversionMetrics(userId, dateRange),
      this.getActivityMetrics(userId, dateRange),
      this.getLeadMetrics(userId, prevRange),
      this.getRevenueMetrics(userId, prevRange),
      this.getConversionMetrics(userId, prevRange),
      this.getActivityMetrics(userId, prevRange),
    ]);

    const delta = (cur: number, prev: number) =>
      prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 1000) / 10;

    return {
      previousPeriod: {
        startDate: prevStart.toISOString().split('T')[0],
        endDate: prevEnd.toISOString().split('T')[0],
      },
      metrics: {
        revenue:    { current: curRevenue.total, previous: prevRevenue.total, deltaPct: delta(curRevenue.total, prevRevenue.total) },
        leads:      { current: curLeads.total,   previous: prevLeads.total,   deltaPct: delta(curLeads.total, prevLeads.total) },
        converted:  { current: curLeads.converted, previous: prevLeads.converted, deltaPct: delta(curLeads.converted, prevLeads.converted) },
        winRate:    { current: curConv.winRate,  previous: prevConv.winRate,  deltaPct: delta(curConv.winRate, prevConv.winRate) },
        activities: { current: curAct.total,     previous: prevAct.total,     deltaPct: delta(curAct.total, prevAct.total) },
      },
    };
  }

  // Follow-up punctuality: completed follow-ups, on-time vs late vs scheduled date.
  async getFollowUpPunctuality(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    const followUps = await prisma.followUp.findMany({
      where: {
        createdById: userId,
        actualDate: { gte: startDate, lte: endDate, not: null },
      },
      select: { scheduledDate: true, actualDate: true },
    });

    let onTime = 0;
    let late = 0;
    let totalDelayDays = 0;
    for (const f of followUps) {
      if (!f.actualDate) continue;
      // A buffer of same calendar day counts as on-time.
      const delayMs = f.actualDate.getTime() - f.scheduledDate.getTime();
      if (delayMs <= 86400000) {
        onTime++;
      } else {
        late++;
        totalDelayDays += Math.floor(delayMs / 86400000);
      }
    }

    const completed = onTime + late;
    return {
      completed,
      onTime,
      late,
      onTimeRate: completed > 0 ? Math.round((onTime / completed) * 1000) / 10 : 0,
      avgDelayDays: late > 0 ? Math.round((totalDelayDays / late) * 10) / 10 : 0,
    };
  }

  // Loss analysis: lost/dropped leads grouped by closureReason.
  async getLossAnalysis(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    const lostLeads = await prisma.lead.findMany({
      where: {
        assignedToId: userId,
        closedAt: { gte: startDate, lte: endDate },
        status: { in: ['LOST', 'DROPPED'] },
      },
      select: { status: true, closureReason: true, quoteValue: true },
    });

    const reasonMap: Record<string, { count: number; lostValue: number }> = {};
    let lostCount = 0;
    let droppedCount = 0;
    let lostValue = 0;
    for (const l of lostLeads) {
      if (l.status === 'LOST') lostCount++; else droppedCount++;
      const val = toNumber(l.quoteValue);
      lostValue += val;
      const reason = l.closureReason?.trim() || 'Unspecified';
      if (!reasonMap[reason]) reasonMap[reason] = { count: 0, lostValue: 0 };
      reasonMap[reason].count++;
      reasonMap[reason].lostValue += val;
    }

    const byReason = Object.entries(reasonMap)
      .map(([reason, d]) => ({ reason, count: d.count, lostValue: d.lostValue }))
      .sort((a, b) => b.count - a.count);

    return { totalLost: lostLeads.length, lostCount, droppedCount, lostValue, byReason };
  }

  // This employee's own deal pipeline by stage, with weighted forecast.
  async getEmployeePipeline(userId: string, dateRange: DateRange) {
    const deals = await prisma.deal.findMany({
      where: {
        assignedToId: userId,
        createdAt: { gte: dateRange.startDate, lte: dateRange.endDate },
      },
      select: { stage: true, dealValue: true, winProbability: true },
    });

    const stageOrder: Record<string, number> = {
      SUSPECT: 0, PROSPECT: 1, APPROACH: 2, NEGOTIATION: 3, CLOSURE: 4, ONGOING: 5,
    };

    const stageMap: Record<string, { dealCount: number; totalValue: number; weightedValue: number }> = {};
    let totalValue = 0;
    let weightedValue = 0;
    for (const d of deals) {
      const val = toNumber(d.dealValue);
      const weighted = (val * d.winProbability) / 100;
      totalValue += val;
      weightedValue += weighted;
      if (!stageMap[d.stage]) stageMap[d.stage] = { dealCount: 0, totalValue: 0, weightedValue: 0 };
      stageMap[d.stage].dealCount++;
      stageMap[d.stage].totalValue += val;
      stageMap[d.stage].weightedValue += weighted;
    }

    const stages = Object.entries(stageMap)
      .map(([stage, d]) => ({
        stage,
        dealCount: d.dealCount,
        totalValue: d.totalValue,
        weightedValue: Math.round(d.weightedValue),
      }))
      .sort((a, b) => (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99));

    return {
      stages,
      totalDeals: deals.length,
      totalValue,
      weightedForecast: Math.round(weightedValue),
    };
  }

  async getTeamMetrics(managerId: string, dateRange: DateRange) {
    // SUPER_ADMIN and ADMIN see everyone; managers see their direct reports
    const caller = await prisma.user.findUnique({ where: { id: managerId }, select: { role: true } });
    const isGlobal = caller && ['SUPER_ADMIN', 'ADMIN'].includes(caller.role);

    const teamMembers = await prisma.user.findMany({
      where: isGlobal ? { isActive: true } : { managerId, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    if (teamMembers.length === 0) {
      return {
        members: [],
        totals: { totalLeads: 0, totalConverted: 0, totalRevenue: 0, totalActivities: 0 },
        average: { revenue: 0, leads: 0, winRate: 0 },
      };
    }

    const memberMetrics = await Promise.all(
      teamMembers.map(async member => {
        const [leadsM, revenueM, conversionM, activitiesM, dailyM] = await Promise.all([
          this.getLeadMetrics(member.id, dateRange),
          this.getRevenueMetrics(member.id, dateRange),
          this.getConversionMetrics(member.id, dateRange),
          this.getActivityMetrics(member.id, dateRange),
          this.getDailyActivityMetrics(member.id, dateRange),
        ]);
        return {
          userId: member.id,
          name: `${member.firstName} ${member.lastName}`,
          role: member.role,
          leads: leadsM.total,
          converted: leadsM.converted,
          revenue: revenueM.total,
          avgDealValue: revenueM.average,
          winRate: conversionM.winRate,
          activities: activitiesM.total,
          dailyActivity: dailyM,
        };
      })
    );

    const sorted = memberMetrics.sort((a, b) => b.revenue - a.revenue);
    const n = sorted.length;

    const totals = {
      totalLeads: sorted.reduce((s, m) => s + m.leads, 0),
      totalConverted: sorted.reduce((s, m) => s + m.converted, 0),
      totalRevenue: sorted.reduce((s, m) => s + m.revenue, 0),
      totalActivities: sorted.reduce((s, m) => s + m.activities, 0),
    };

    return {
      members: sorted.map((m, i) => ({ ...m, rank: i + 1 })),
      totals,
      average: {
        revenue: Math.round(totals.totalRevenue / n),
        leads: Math.round(totals.totalLeads / n),
        winRate: Math.round((sorted.reduce((s, m) => s + m.winRate, 0) / n) * 10) / 10,
      },
    };
  }

  async getPipelineHealth(dateRange: DateRange) {
    const stageRows = await prisma.deal.groupBy({
      by: ['stage'],
      where: { createdAt: { gte: dateRange.startDate, lte: dateRange.endDate } },
      _count: true,
      _sum: { dealValue: true },
      _avg: { dealValue: true },
    });

    const stageOrder: Record<string, number> = {
      SUSPECT: 0, PROSPECT: 1, APPROACH: 2, NEGOTIATION: 3, CLOSURE: 4, ONGOING: 5,
    };

    const stages = stageRows
      .map(s => ({
        stage: s.stage,
        dealCount: s._count,
        totalValue: toNumber(s._sum.dealValue),
        avgValue: toNumber(s._avg.dealValue),
      }))
      .sort((a, b) => (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99));

    const totalPipeline = stages.reduce((sum, s) => sum + s.totalValue, 0);
    const totalDeals = stages.reduce((sum, s) => sum + s.dealCount, 0);

    return { stages, forecast: { expectedRevenue: totalPipeline, totalDeals } };
  }
}

export const reportCalculator = new ReportCalculator();
