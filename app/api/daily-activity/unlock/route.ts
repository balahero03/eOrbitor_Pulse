import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError, ValidationError } from '@/lib/errors';

// POST /api/daily-activity/unlock — user requests unlock for a locked date
export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { date, reason } = await req.json();
  if (!date) throw new ValidationError('Date is required');
  if (!reason?.trim()) throw new ValidationError('Reason is required');

  const today = new Date().toISOString().split('T')[0];
  if (date > today) throw new ValidationError('Cannot request unlock for future dates');

  // Prevent duplicate pending requests
  const existing = await prisma.activityUnlockRequest.findFirst({
    where: { userId: user.id, date, status: 'PENDING' },
  });
  if (existing) return NextResponse.json({ message: 'Unlock request already pending for this date' }, { status: 409 });

  const req2 = await prisma.activityUnlockRequest.create({
    data: { userId: user.id, date, reason: reason.trim(), status: 'PENDING' },
  });

  return NextResponse.json({ message: 'Unlock request submitted', request: req2 }, { status: 201 });
});

// GET /api/daily-activity/unlock — admin/support gets all pending requests
export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(user.role)) throw new ForbiddenError();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PENDING';

  const requests = await prisma.activityUnlockRequest.findMany({
    where: { ...(status !== 'ALL' && { status }) },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ requests });
});

// PATCH /api/daily-activity/unlock — admin/support approves or rejects
export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(user.role)) throw new ForbiddenError();

  const { requestId, action } = await req.json(); // action: 'APPROVE' | 'REJECT'
  if (!requestId || !['APPROVE', 'REJECT'].includes(action)) {
    throw new ValidationError('requestId and action (APPROVE|REJECT) are required');
  }

  const unlockReq = await prisma.activityUnlockRequest.findUnique({ where: { id: requestId } });
  if (!unlockReq) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

  await prisma.activityUnlockRequest.update({
    where: { id: requestId },
    data: { status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewedBy: user.id, reviewedAt: new Date() },
  });

  if (action === 'APPROVE') {
    // Unlock the day — upsert the DailyActivity with unlockedBy set
    await prisma.dailyActivity.upsert({
      where: { userId_date: { userId: unlockReq.userId, date: unlockReq.date } },
      update: { unlockedBy: user.id, unlockedAt: new Date() },
      create: {
        userId: unlockReq.userId,
        date: unlockReq.date,
        activities: '[]',
        unlockedBy: user.id,
        unlockedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ message: `Request ${action === 'APPROVE' ? 'approved' : 'rejected'}` });
});
