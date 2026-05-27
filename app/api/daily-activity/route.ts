import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function formatDateString(dateInput: string | Date): string {
  if (typeof dateInput === 'string') {
    return dateInput;
  }
  return dateInput.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || decoded.id;
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Permission check: users can view their own, managers can view team, admins can view all
    if (userId !== decoded.id) {
      if (decoded.role === 'SALES_EXEC') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (decoded.role === 'SALES_MANAGER') {
        const subordinates = await prisma.user.findMany({
          where: { managerId: decoded.id },
          select: { id: true },
        });
        const teamIds = [decoded.id, ...subordinates.map((u: any) => u.id)];
        if (!teamIds.includes(userId)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    const dateFormatted = formatDateString(dateStr);

    const activity = await prisma.dailyActivity.findUnique({
      where: {
        userId_date: {
          userId,
          date: dateFormatted,
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!activity) {
      return NextResponse.json({ data: null });
    }

    const today = new Date().toISOString().split('T')[0];

    // Can edit today and yesterday (until tomorrow morning)
    const isEditable = dateFormatted <= today;

    return NextResponse.json({
      data: {
        ...activity,
        activities: JSON.parse(activity.activities || '[]'),
        isEditable,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { activities, notes, date: dateStr } = await req.json();

    if (!dateStr) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const dateFormatted = formatDateString(dateStr);
    const today = new Date().toISOString().split('T')[0];

    // Can only edit today and yesterday (until tomorrow)
    if (dateFormatted > today) {
      return NextResponse.json({ error: 'Cannot create activity for future dates' }, { status: 400 });
    }

    let activity = await prisma.dailyActivity.findUnique({
      where: {
        userId_date: {
          userId: decoded.id,
          date: dateFormatted,
        },
      },
    });

    if (activity) {
      activity = await prisma.dailyActivity.update({
        where: { id: activity.id },
        data: {
          activities: JSON.stringify(activities || []),
          notes: notes || null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } else {
      activity = await prisma.dailyActivity.create({
        data: {
          userId: decoded.id,
          date: dateFormatted,
          activities: JSON.stringify(activities || []),
          notes: notes || null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    }

    return NextResponse.json({
      message: 'Activity saved',
      data: { ...activity, activities: JSON.parse(activity.activities || '[]') },
    }, { status: 201 });
  } catch (error) {
    console.error('Daily activity save error:', error);
    return NextResponse.json({ error: 'Failed to save activity', details: String(error) }, { status: 500 });
  }
}
