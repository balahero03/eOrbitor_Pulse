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

    // This closes the login *session* only (TimeLog) — routine, silent,
    // happens as often as someone signs in/out. It deliberately does NOT
    // touch DailyActivity.logoutTime/totalHours: that's the attendance
    // record, and the client wants it set only by the employee explicitly
    // declaring their exit time on the Daily Activity page, never guessed.
    const logoutTime = new Date();
    const sessionDuration = Math.floor((logoutTime.getTime() - lastLog.loginTime.getTime()) / 1000);

    await prisma.timeLog.update({
      where: { id: lastLog.id },
      data: { logoutTime, sessionDuration },
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
