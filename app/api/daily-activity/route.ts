import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';
import { istToday, daysBetweenIstDates } from '@/lib/istDate';

const EDIT_WINDOW_DAYS = 2;

function isWithinEditWindow(dateStr: string): boolean {
  // Both sides are now IST calendar dates. This used to measure from the
  // *server's* local midnight while the future-date guard below measured from
  // UTC, so the two checks in this same file could disagree about what day it
  // was — one reporting a date editable that the other rejected as future.
  const diffDays = daysBetweenIstDates(dateStr, istToday());
  if (Number.isNaN(diffDays)) return false;
  // A future date yields a negative diff, which used to satisfy `<= 2` and so
  // reported itself as editable — the UI then offered "+ Add Activity" for a
  // day that hasn't happened, and POST rejected the save with "Cannot log
  // future dates". The window only ever opens backwards.
  return diffDays >= 0 && diffDays <= EDIT_WINDOW_DAYS;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || user.id;
  const dateStr = searchParams.get('date') || istToday();

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
  const { activities, notes, date: dateStr, loginTime, logoutTime, markExitNow } = await req.json();

  if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

  const today = istToday();
  if (dateStr > today) return NextResponse.json({ error: 'Cannot log future dates' }, { status: 400 });

  if (markExitNow && dateStr !== today) {
    return NextResponse.json({ error: 'Exit time can only be marked for today.' }, { status: 400 });
  }

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

  // "Mark Exit Now" is deliberately not a client-editable field — an
  // employee could otherwise just set their device clock back and claim an
  // earlier exit. The server's own clock is the only source of truth here,
  // same as how first login time is stamped in the login route.
  const finalLogoutTime = markExitNow
    ? new Date()
    : logoutTime !== undefined
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
    let rawMins = (finalLogoutTime.getTime() - finalLoginTime.getTime()) / (1000 * 60);
    // If logout is numerically earlier on the same day (crosses midnight)
    if (rawMins < 0 && rawMins > -1440) {
      rawMins += 24 * 60;
    }
    const calcHours = Math.round((rawMins / 60) * 100) / 100;
    data.totalHours = (calcHours >= 0 && calcHours <= 24) ? calcHours : 0;
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
