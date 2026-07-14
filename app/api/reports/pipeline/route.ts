import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { reportCalculator, type DateRange } from '@/lib/reports/calculator';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const rawStart = sp.get('startDate');
  const rawEnd = sp.get('endDate');
  const startDate = rawStart ? new Date(rawStart) : new Date(Date.now() - 30 * 86400000);
  const endDate = rawEnd ? new Date(rawEnd) : new Date();
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ message: 'Invalid date range' }, { status: 400 });
  }

  const dateRange: DateRange = { startDate, endDate };
  const pipelineHealth = await reportCalculator.getPipelineHealth(dateRange);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

  const reportData = {
    reportType: 'PIPELINE',
    period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], days },
    metrics: pipelineHealth,
  };

  const saved = await prisma.report.create({
    data: {
      type: 'PIPELINE',
      startDate,
      endDate,
      data: reportData as any,
      createdById: user.id,
    },
  });

  return NextResponse.json({ ...reportData, id: saved.id });
});
