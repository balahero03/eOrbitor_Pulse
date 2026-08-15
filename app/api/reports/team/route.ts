import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { reportCalculator, type DateRange } from '@/lib/reports/calculator';
import { prisma } from '@/lib/prisma';
import { istToday, istDateString } from '@/lib/istDate';

const MANAGER_ROLES = ['BACKEND_TEAM', 'ADMIN', 'SUPER_ADMIN'];

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const managerId = sp.get('managerId') ?? user.id;

  const rawStart = sp.get('startDate');
  const rawEnd = sp.get('endDate');
  // The range is a pair of IST calendar days, resolved to explicit instants.
  //
  // It used to be `new Date(rawStart)` — which parses a bare 'YYYY-MM-DD' as
  // UTC midnight, i.e. 05:30 IST — paired with `setHours(23, 59, 59, 999)`,
  // which lands wherever the *server's* timezone happens to be. So the same
  // request returned different numbers depending on the host: on a UTC
  // container (the Docker default here) the window ran from 05:30 IST on the
  // start day through 05:29 IST on the day *after* the end day, quietly
  // counting the next morning's closures against the selected period while
  // dropping the first five and a half hours of the first day. Pinning +05:30
  // makes the boundaries mean what the date picker says they mean, on any host.
  const startDate = rawStart
    ? new Date(`${rawStart}T00:00:00.000+05:30`)
    : new Date(Date.now() - 30 * 86400000);
  const endDate = rawEnd
    ? new Date(`${rawEnd}T23:59:59.999+05:30`)
    : new Date(`${istToday()}T23:59:59.999+05:30`);

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
    period: { startDate: istDateString(startDate), endDate: istDateString(endDate), days },
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
