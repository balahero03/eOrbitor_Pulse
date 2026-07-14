import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (_req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const reports = await prisma.report.findMany({
    where: {
      OR: [{ createdById: user.id }, { userId: user.id }, { managerId: user.id }],
    },
    select: { id: true, type: true, generatedAt: true, startDate: true, endDate: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json(reports);
});
