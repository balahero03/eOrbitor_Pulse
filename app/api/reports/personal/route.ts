import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { reportCalculator, type DateRange } from '@/lib/reports/calculator';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (req: NextRequest, authUser: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(authUser.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const userId = sp.get('userId') ?? authUser.id;

  const rawStart = sp.get('startDate');
  const rawEnd = sp.get('endDate');
  const startDate = rawStart ? new Date(rawStart) : new Date(Date.now() - 30 * 86400000);
  const endDate = rawEnd ? new Date(rawEnd) : new Date();
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ message: 'Invalid date range' }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ message: 'startDate must be before endDate' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  const dateRange: DateRange = { startDate, endDate };

  const [leads, revenue, conversion, activities, salesCycle, performance, topDeals, dailyActivity, comparison, followUpPunctuality, lossAnalysis, pipeline] = await Promise.all([
    reportCalculator.getLeadMetrics(userId, dateRange),
    reportCalculator.getRevenueMetrics(userId, dateRange),
    reportCalculator.getConversionMetrics(userId, dateRange),
    reportCalculator.getActivityMetrics(userId, dateRange),
    reportCalculator.getSalesCycleMetrics(userId, dateRange),
    reportCalculator.getPerformanceScore(userId, dateRange),
    reportCalculator.getTopDeals(userId, dateRange),
    reportCalculator.getDailyActivityMetrics(userId, dateRange),
    reportCalculator.getPeriodComparison(userId, dateRange),
    reportCalculator.getFollowUpPunctuality(userId, dateRange),
    reportCalculator.getLossAnalysis(userId, dateRange),
    reportCalculator.getEmployeePipeline(userId, dateRange),
  ]);

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

  const reportData = {
    reportType: 'PERSONAL',
    user: { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role },
    period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], days },
    metrics: { leads, revenue, conversion, activities, salesCycle, performance, dailyActivity, comparison, followUpPunctuality, lossAnalysis, pipeline },
    topDeals,
  };

  const saved = await prisma.report.create({
    data: {
      type: 'PERSONAL',
      userId,
      startDate,
      endDate,
      data: reportData as any,
      createdById: authUser.id,
    },
  });

  return NextResponse.json({ ...reportData, id: saved.id });
});
