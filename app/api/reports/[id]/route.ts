import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  if (!['SUPER_ADMIN', 'ADMIN'].includes(decoded.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ message: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json({ ...((report.data as any) ?? {}), id: report.id });
}
