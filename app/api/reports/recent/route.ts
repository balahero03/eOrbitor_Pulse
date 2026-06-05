import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET ?? 'dev-secret');
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const reports = await prisma.report.findMany({
    where: {
      OR: [{ createdById: decoded.id }, { userId: decoded.id }, { managerId: decoded.id }],
    },
    select: { id: true, type: true, generatedAt: true, startDate: true, endDate: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json(reports);
}
