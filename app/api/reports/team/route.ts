import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { reportCalculator, type DateRange } from '@/lib/reports/calculator';
import { prisma } from '@/lib/prisma';

const MANAGER_ROLES = ['BACKEND_TEAM', 'ADMIN', 'SUPER_ADMIN'];

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const managerId = sp.get('managerId') ?? user.id;

  const rawStart = sp.get('startDate');
  const rawEnd = sp.get('endDate');
  const startDate = rawStart ? new Date(rawStart) : new Date(Date.now() - 30 * 86400000);
  const endDate = rawEnd ? new Date(rawEnd) : new Date();
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ message: 'Invalid date range' }, { status: 400 });
  }

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
  });

  if (!manager || !manager.isActive) {
    return NextResponse.json({ message: 'Manager not found' }, { status: 404 });
  }
  if (!MANAGER_ROLES.includes(manager.role)) {
    return NextResponse.json({ message: 'Forbidden: requires manager role' }, { status: 403 });
  }

  const dateRange: DateRange = { startDate, endDate };
  const teamMetrics = await reportCalculator.getTeamMetrics(managerId, dateRange);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

  const reportData = {
    reportType: 'TEAM',
    manager: { id: manager.id, name: `${manager.firstName} ${manager.lastName}`, role: manager.role },
    period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], days },
    teamSize: teamMetrics.members.length,
    metrics: teamMetrics,
  };

  const saved = await prisma.report.create({
    data: {
      type: 'TEAM',
      managerId,
      startDate,
      endDate,
      data: reportData as any,
      createdById: user.id,
    },
  });

  return NextResponse.json({ ...reportData, id: saved.id });
});
