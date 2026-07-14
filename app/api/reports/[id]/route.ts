import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_req: NextRequest, user: AuthUser, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ message: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json({ ...((report.data as any) ?? {}), id: report.id });
});
