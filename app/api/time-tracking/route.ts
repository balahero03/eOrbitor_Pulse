import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { action } = await req.json();

  if (action === 'LOGOUT') {
    const lastLog = await prisma.timeLog.findFirst({
      where: { userId: user.id, logoutTime: null },
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

    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const todayLogs = await prisma.timeLog.findMany({
      where: {
        userId: user.id,
        loginTime: { gte: dayStart, lt: dayEnd },
        logoutTime: { not: null },
      },
    });
    const totalSecs = todayLogs.reduce((s, l) => s + (l.sessionDuration || 0), 0);

    await prisma.dailyActivity.upsert({
      where: { userId_date: { userId: user.id, date: dateStr } },
      update: {
        logoutTime,
        totalHours: parseFloat((totalSecs / 3600).toFixed(2)),
      },
      create: {
        userId: user.id,
        date: dateStr,
        activities: JSON.stringify([]),
        loginTime: lastLog.loginTime,
        logoutTime,
        totalHours: parseFloat((totalSecs / 3600).toFixed(2)),
      },
    });

    return NextResponse.json({ message: 'Logged out', sessionDuration });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const currentSession = await prisma.timeLog.findFirst({
    where: { userId: user.id, logoutTime: null },
    orderBy: { loginTime: 'desc' },
  });

  return NextResponse.json({
    isLoggedIn: !!currentSession,
    loginTime: currentSession?.loginTime,
  });
});
