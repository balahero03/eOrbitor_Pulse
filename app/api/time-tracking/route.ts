import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { action } = await req.json();

    if (action === 'LOGOUT') {
      const lastLog = await prisma.timeLog.findFirst({
        where: { userId: decoded.id, logoutTime: null },
        orderBy: { loginTime: 'desc' },
      });

      if (!lastLog) {
        return NextResponse.json({ error: 'No active session' }, { status: 400 });
      }

      const logoutTime = new Date();
      const sessionDuration = Math.floor((logoutTime.getTime() - lastLog.loginTime.getTime()) / 1000);
      const dateStr = lastLog.loginTime.toISOString().slice(0, 10);

      await prisma.timeLog.update({
        where: { id: lastLog.id },
        data: { logoutTime, sessionDuration },
      });

      // Sum all completed sessions today to get totalHours
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const todayLogs = await prisma.timeLog.findMany({
        where: {
          userId: decoded.id,
          loginTime: { gte: dayStart, lt: dayEnd },
          logoutTime: { not: null },
        },
      });
      const totalSecs = todayLogs.reduce((s, l) => s + (l.sessionDuration || 0), 0);

      // Update DailyActivity with last logout time and total hours
      await prisma.dailyActivity.upsert({
        where: { userId_date: { userId: decoded.id, date: dateStr } },
        update: {
          logoutTime,
          totalHours: parseFloat((totalSecs / 3600).toFixed(2)),
        },
        create: {
          userId: decoded.id,
          date: dateStr,
          activities: JSON.stringify([]),
          loginTime: lastLog.loginTime,
          logoutTime,
          totalHours: parseFloat((totalSecs / 3600).toFixed(2)),
        },
      });

      return NextResponse.json({ message: 'Logged out', sessionDuration }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to track time' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const currentSession = await prisma.timeLog.findFirst({
      where: { userId: decoded.id, logoutTime: null },
      orderBy: { loginTime: 'desc' },
    });

    return NextResponse.json({
      isLoggedIn: !!currentSession,
      loginTime: currentSession?.loginTime,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
