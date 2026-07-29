import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, requireRoles, AuthUser } from '@/lib/middleware/auth';
import { createNotification } from '@/lib/notify';
import { ValidationError, NotFoundError } from '@/lib/errors';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const PATCH = withAuth(
  requireRoles(ADMIN_ROLES)(async (req: NextRequest, user: AuthUser, context?: any) => {
    const { id } = await context.params;
    const { action, rejectionReason } = await req.json();

    if (action !== 'APPROVE' && action !== 'REJECT') {
      throw new ValidationError('action must be APPROVE or REJECT');
    }

    const afterHoursReq = await prisma.afterHoursAccessRequest.findUnique({ where: { id } });
    if (afterHoursReq) {
      const updated = await prisma.afterHoursAccessRequest.update({
        where: { id },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          ...(action === 'REJECT' && { rejectionReason: rejectionReason || null }),
        },
      });

      await createNotification(
        afterHoursReq.userId,
        action === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
        action === 'APPROVE' ? 'After-Hours Access Approved' : 'After-Hours Access Rejected',
        action === 'APPROVE'
          ? `Your after-hours access request for ${afterHoursReq.date} was approved.`
          : `Your after-hours access request for ${afterHoursReq.date} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        'AFTER_HOURS_ACCESS',
        afterHoursReq.id
      );

      return NextResponse.json(updated);
    }

    const activityUnlockReq = await prisma.activityUnlockRequest.findUnique({ where: { id } });
    if (activityUnlockReq) {
      const updated = await prisma.activityUnlockRequest.update({
        where: { id },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: user.id,
          reviewedAt: new Date(),
          ...(action === 'REJECT' && { rejectionReason: rejectionReason || null }),
        },
      });

      if (action === 'APPROVE') {
        await prisma.dailyActivity.upsert({
          where: { userId_date: { userId: activityUnlockReq.userId, date: activityUnlockReq.date } },
          update: { unlockedBy: user.id, unlockedAt: new Date() },
          create: {
            userId: activityUnlockReq.userId,
            date: activityUnlockReq.date,
            activities: '[]',
            unlockedBy: user.id,
            unlockedAt: new Date(),
          },
        });
      }

      await createNotification(
        activityUnlockReq.userId,
        action === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
        action === 'APPROVE' ? 'Daily Activity Unlock Approved' : 'Daily Activity Unlock Rejected',
        action === 'APPROVE'
          ? `Your unlock request for ${activityUnlockReq.date} was approved. You can now edit your activity.`
          : `Your unlock request for ${activityUnlockReq.date} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        'ACTIVITY_UNLOCK',
        activityUnlockReq.id
      );

      return NextResponse.json(updated);
    }

    throw new NotFoundError('Access request');
  })
);
