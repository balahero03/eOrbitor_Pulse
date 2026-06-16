import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { reportCalculator, type DateRange } from '@/lib/reports/calculator';
import { prisma } from '@/lib/prisma';

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (!['SUPER_ADMIN', 'ADMIN'].includes(decoded.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const userId = sp.get('userId') ?? decoded.id;

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

  const [leads, revenue, conversion, activities, salesCycle, performance, topDeals, dailyActivity] = await Promise.all([
    reportCalculator.getLeadMetrics(userId, dateRange),
    reportCalculator.getRevenueMetrics(userId, dateRange),
    reportCalculator.getConversionMetrics(userId, dateRange),
    reportCalculator.getActivityMetrics(userId, dateRange),
    reportCalculator.getSalesCycleMetrics(userId, dateRange),
    reportCalculator.getPerformanceScore(userId, dateRange),
    reportCalculator.getTopDeals(userId, dateRange),
    reportCalculator.getDailyActivityMetrics(userId, dateRange),
  ]);

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

  const reportData = {
    reportType: 'PERSONAL',
    user: { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role },
    period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], days },
    metrics: { leads, revenue, conversion, activities, salesCycle, performance, dailyActivity },
    topDeals,
  };

  const saved = await prisma.report.create({
    data: {
      type: 'PERSONAL',
      userId,
      startDate,
      endDate,
      data: reportData as any,
      createdById: decoded.id,
    },
  });

  return NextResponse.json({ ...reportData, id: saved.id });
}
