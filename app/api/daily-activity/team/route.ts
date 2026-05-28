import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Super admin — activity is never visible to anyone
const SUPER_ADMIN_EMAIL = 'lokeswaran.k@eorbitor.com';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!['SUPER_ADMIN','ADMIN'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get('userId');
    const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const mode = searchParams.get('mode'); // 'day' = exact date, default = full month

    let startDate: string;
    let endDate: string;

    if (mode === 'day') {
      // Exact date filter for team-activity page
      startDate = dateParam;
      endDate = dateParam;
    } else {
      // Full month range for attendance calendar
      const parts = dateParam.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const monthStr = String(month).padStart(2, '0');
      startDate = `${year}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    }

    // Resolve super admin's userId to exclude them
    const superAdmin = await prisma.user.findUnique({
      where: { email: SUPER_ADMIN_EMAIL },
      select: { id: true },
    });
    const superAdminId = superAdmin?.id;

    // Block direct lookup of super admin's activity
    if (filterUserId && filterUserId === superAdminId) {
      return NextResponse.json({ data: [] });
    }

    const where: any = {
      date: { gte: startDate, lte: endDate },
      ...(superAdminId && { userId: { not: superAdminId } }),
    };

    if (filterUserId) {
      where.userId = filterUserId;
    }

    const activities = await prisma.dailyActivity.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: [{ date: 'asc' }, { user: { firstName: 'asc' } }],
    });

    const data = activities.map(a => ({
      id: a.id,
      userId: a.userId,
      date: a.date,
      loginTime: a.loginTime,
      logoutTime: a.logoutTime,
      totalHours: a.totalHours ? Number(a.totalHours) : null,
      activities: (() => { try { return JSON.parse(a.activities || '[]'); } catch { return []; } })(),
      notes: a.notes,
      user: a.user,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch team activities' }, { status: 500 });
  }
}
