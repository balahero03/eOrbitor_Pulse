import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

const SUPER_ADMIN_EMAIL = 'lokeswaran.k@eorbitor.com';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const filterUserId = searchParams.get('userId');
  const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const mode = searchParams.get('mode');

  let startDate: string;
  let endDate: string;

  if (mode === 'day') {
    startDate = dateParam;
    endDate = dateParam;
  } else {
    const parts = dateParam.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const monthStr = String(month).padStart(2, '0');
    startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }

  const superAdmin = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  const superAdminId = superAdmin?.id;

  if (filterUserId && filterUserId === superAdminId) {
    return NextResponse.json({ data: [] });
  }

  const where: any = {
    date: { gte: startDate, lte: endDate },
    ...(superAdminId && { userId: { not: superAdminId } }),
  };

  // Managers only see their team
  if (user.role === 'SALES_MANAGER') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.userId = { in: teamIds };
  }

  if (filterUserId) where.userId = filterUserId;

  const activities = await prisma.dailyActivity.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: [{ date: 'asc' }, { user: { firstName: 'asc' } }],
  });

  const data = activities.map((a) => ({
    id: a.id, userId: a.userId, date: a.date,
    loginTime: a.loginTime, logoutTime: a.logoutTime,
    totalHours: a.totalHours ? Number(a.totalHours) : null,
    activities: (() => { try { return JSON.parse(a.activities || '[]'); } catch { return []; } })(),
    notes: a.notes, user: a.user,
  }));

  return NextResponse.json({ data });
});
