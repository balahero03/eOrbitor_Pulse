import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ message: 'User account is inactive' }, { status: 403 });
    }

    const now = new Date();
    const dateStr = todayStr();

    // Auto-close any open TimeLog from a previous day
    const openLog = await prisma.timeLog.findFirst({
      where: { userId: user.id, logoutTime: null },
      orderBy: { loginTime: 'desc' },
    });

    if (openLog) {
      const openDate = openLog.loginTime.toISOString().slice(0, 10);
      if (openDate !== dateStr) {
        // Close the previous day's session at midnight of that day
        const midnight = new Date(openLog.loginTime);
        midnight.setHours(23, 59, 59, 0);
        const duration = Math.floor((midnight.getTime() - openLog.loginTime.getTime()) / 1000);

        await prisma.timeLog.update({
          where: { id: openLog.id },
          data: { logoutTime: midnight, sessionDuration: duration },
        });

        // Update previous day's DailyActivity logoutTime + totalHours
        const prevDailyActivity = await prisma.dailyActivity.findUnique({
          where: { userId_date: { userId: user.id, date: openDate } },
        });
        if (prevDailyActivity) {
          const totalSecs = await prisma.timeLog.findMany({
            where: {
              userId: user.id,
              loginTime: { gte: new Date(openDate), lt: new Date(dateStr) },
              logoutTime: { not: null },
            },
          }).then(logs => logs.reduce((s, l) => s + (l.sessionDuration || 0), 0));

          await prisma.dailyActivity.update({
            where: { id: prevDailyActivity.id },
            data: {
              logoutTime: midnight,
              totalHours: parseFloat((totalSecs / 3600).toFixed(2)),
            },
          });
        }
      }
    }

    // Create new TimeLog for this login
    await prisma.timeLog.create({
      data: { userId: user.id, loginTime: now },
    });

    // Upsert today's DailyActivity — set loginTime only if this is the first login today
    const existing = await prisma.dailyActivity.findUnique({
      where: { userId_date: { userId: user.id, date: dateStr } },
    });

    if (!existing) {
      await prisma.dailyActivity.create({
        data: {
          userId: user.id,
          date: dateStr,
          activities: JSON.stringify([]),
          loginTime: now,
        },
      });
    }
    // If already exists, loginTime stays as the first login of the day — don't overwrite

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
