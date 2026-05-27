import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get('userId');

    // Expect ?year=2026&month=5 OR ?date=2026-05-01
    let year: number;
    let month: number; // 1-based

    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parts = dateParam.split('-');
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
      month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    }

    // Build date range strings for the full month
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const where: any = {
      date: { gte: startDate, lte: endDate },
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
