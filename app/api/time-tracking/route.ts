import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { action } = await req.json();

    if (action === 'LOGIN') {
      const timeLog = await prisma.timeLog.create({
        data: {
          userId: decoded.id,
          loginTime: new Date(),
        },
      });

      return NextResponse.json({ message: 'Logged in', timeLogId: timeLog.id }, { status: 200 });
    } else if (action === 'LOGOUT') {
      const lastLog = await prisma.timeLog.findFirst({
        where: { userId: decoded.id, logoutTime: null },
        orderBy: { loginTime: 'desc' },
      });

      if (!lastLog) {
        return NextResponse.json({ error: 'No active session' }, { status: 400 });
      }

      const logoutTime = new Date();
      const sessionDuration = Math.floor((logoutTime.getTime() - lastLog.loginTime.getTime()) / 1000);

      await prisma.timeLog.update({
        where: { id: lastLog.id },
        data: {
          logoutTime,
          sessionDuration,
        },
      });

      // Update or create daily activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let activity = await prisma.dailyActivity.findUnique({
        where: {
          userId_date: {
            userId: decoded.id,
            date: today,
          },
        },
      });

      if (!activity) {
        activity = await prisma.dailyActivity.create({
          data: {
            userId: decoded.id,
            date: today,
            activities: JSON.stringify([]),
            loginTime: lastLog.loginTime,
            logoutTime,
          },
        });
      } else {
        const totalHours = (sessionDuration / 3600).toFixed(2);
        await prisma.dailyActivity.update({
          where: { id: activity.id },
          data: {
            logoutTime,
          },
        });
      }

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
