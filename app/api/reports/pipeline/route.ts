import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { reportCalculator, type DateRange } from '@/lib/reports/calculator';
import { prisma } from '@/lib/prisma';

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret');
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const rawStart = sp.get('startDate');
  const rawEnd = sp.get('endDate');
  const startDate = rawStart ? new Date(rawStart) : new Date(Date.now() - 30 * 86400000);
  const endDate = rawEnd ? new Date(rawEnd) : new Date();
  endDate.setHours(23, 59, 59, 999);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ message: 'Invalid date range' }, { status: 400 });
  }

  const dateRange: DateRange = { startDate, endDate };
  const pipelineHealth = await reportCalculator.getPipelineHealth(dateRange);
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

  const reportData = {
    reportType: 'PIPELINE',
    period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], days },
    metrics: pipelineHealth,
  };

  const saved = await prisma.report.create({
    data: {
      type: 'PIPELINE',
      startDate,
      endDate,
      data: reportData as any,
      createdById: decoded.id,
    },
  });

  return NextResponse.json({ ...reportData, id: saved.id });
}
