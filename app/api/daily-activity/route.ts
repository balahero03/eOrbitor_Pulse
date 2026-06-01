import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || user.id;
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  // Permission: users can view own; managers can view team; admins can view all
  if (userId !== user.id) {
    if (user.role === 'SALES_EXEC') throw new ForbiddenError();
    if (user.role === 'SALES_MANAGER') {
      const subordinates = await prisma.user.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const teamIds = [user.id, ...subordinates.map((u) => u.id)];
      if (!teamIds.includes(userId)) throw new ForbiddenError();
    }
  }

  const activity = await prisma.dailyActivity.findUnique({
    where: { userId_date: { userId, date: dateStr } },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  if (!activity) return NextResponse.json({ data: null });

  const today = new Date().toISOString().split('T')[0];
  let totalHours = null;
  if (activity.loginTime && activity.logoutTime) {
    totalHours = (new Date(activity.logoutTime).getTime() - new Date(activity.loginTime).getTime()) / (1000 * 60 * 60);
  }

  return NextResponse.json({
    data: {
      ...activity,
      activities: JSON.parse(activity.activities || '[]'),
      isEditable: dateStr <= today,
      totalHours,
    },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { activities, notes, date: dateStr } = await req.json();

  if (!dateStr) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  if (dateStr > today) {
    return NextResponse.json({ error: 'Cannot create activity for future dates' }, { status: 400 });
  }

  let activity = await prisma.dailyActivity.findUnique({
    where: { userId_date: { userId: user.id, date: dateStr } },
  });

  if (activity) {
    activity = await prisma.dailyActivity.update({
      where: { id: activity.id },
      data: { activities: JSON.stringify(activities || []), notes: notes || null },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  } else {
    activity = await prisma.dailyActivity.create({
      data: {
        userId: user.id,
        date: dateStr,
        activities: JSON.stringify(activities || []),
        notes: notes || null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  return NextResponse.json({
    message: 'Activity saved',
    data: { ...activity, activities: JSON.parse(activity.activities || '[]') },
  }, { status: 201 });
});
