import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

const EDIT_WINDOW_DAYS = 2;

function isWithinEditWindow(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const actDate = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.floor((today.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= EDIT_WINDOW_DAYS;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || user.id;
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  if (userId !== user.id) {
    if (user.role === 'ON_FIELD_TEAM') throw new ForbiddenError();
    if (user.role === 'BACKEND_TEAM') {
      const subs = await prisma.user.findMany({ where: { managerId: user.id }, select: { id: true } });
      if (![user.id, ...subs.map(u => u.id)].includes(userId)) throw new ForbiddenError();
    }
  }

  const [activity, unlockRequest] = await Promise.all([
    prisma.dailyActivity.findUnique({
      where: { userId_date: { userId, date: dateStr } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.activityUnlockRequest.findFirst({
      where: { userId, date: dateStr },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const withinWindow = isWithinEditWindow(dateStr);
  const isUnlocked = !!activity?.unlockedBy;
  const isEditable = withinWindow || isUnlocked;

  return NextResponse.json({
    data: activity
      ? { ...activity, activities: JSON.parse(activity.activities || '[]'), isEditable }
      : null,
    isEditable,
    withinWindow,
    unlockRequest: unlockRequest || null,
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { activities, notes, date: dateStr, loginTime, logoutTime } = await req.json();

  if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

  const today = new Date().toISOString().split('T')[0];
  if (dateStr > today) return NextResponse.json({ error: 'Cannot log future dates' }, { status: 400 });

  const withinWindow = isWithinEditWindow(dateStr);
  const existing = await prisma.dailyActivity.findUnique({
    where: { userId_date: { userId: user.id, date: dateStr } },
  });

  if (!withinWindow && !existing?.unlockedBy) {
    return NextResponse.json({ error: 'This date is locked. Request admin/support to unlock it.' }, { status: 403 });
  }

  // First login time is permanent: once recorded for the day it is never
  // overwritten. Last logout time always advances to the most recent value.
  const finalLoginTime = existing?.loginTime
    ? existing.loginTime
    : loginTime
    ? new Date(loginTime)
    : null;

  const finalLogoutTime =
    logoutTime !== undefined
      ? logoutTime
        ? new Date(logoutTime)
        : existing?.logoutTime ?? null
      : existing?.logoutTime ?? null;

  const data: any = {
    activities: JSON.stringify(activities || []),
    notes: notes || null,
    loginTime: finalLoginTime,
    logoutTime: finalLogoutTime,
  };

  if (finalLoginTime && finalLogoutTime) {
    data.totalHours = (finalLogoutTime.getTime() - finalLoginTime.getTime()) / (1000 * 60 * 60);
  } else {
    data.totalHours = null;
  }

  const activity = await prisma.dailyActivity.upsert({
    where: { userId_date: { userId: user.id, date: dateStr } },
    update: data,
    create: { userId: user.id, date: dateStr, ...data },
  });

  return NextResponse.json({
    message: 'Activity saved',
    data: { ...activity, activities: JSON.parse(activity.activities || '[]') },
  }, { status: 201 });
});
