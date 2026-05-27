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

    if (!['ADMIN', 'SALES_MANAGER'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const filterUserId = searchParams.get('userId');

    const dateFormatted = formatDateString(dateStr);

    let userIds: string[] = [];

    if (decoded.role === 'SALES_MANAGER') {
      const subordinates = await prisma.user.findMany({
        where: { managerId: decoded.id },
        select: { id: true },
      });
      userIds = [decoded.id, ...subordinates.map((u: any) => u.id)];
    }
    // ADMIN sees all, so userIds stays empty

    const where: any = { date: dateFormatted };
    if (userIds.length > 0) {
      where.userId = { in: userIds };
    }
    if (filterUserId) {
      where.userId = filterUserId;
    }

    const [activities, total] = await Promise.all([
      prisma.dailyActivity.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { user: { firstName: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dailyActivity.count({ where }),
    ]);

    const data = activities.map(a => ({
      ...a,
      activities: JSON.parse(a.activities || '[]'),
    }));

    return NextResponse.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch team activities' }, { status: 500 });
  }
}
