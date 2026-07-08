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

    const existing = await prisma.afterHoursAccessRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Access request');

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
      existing.userId,
      action === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      action === 'APPROVE' ? 'After-Hours Access Approved' : 'After-Hours Access Rejected',
      action === 'APPROVE'
        ? `Your after-hours access request for ${existing.date} was approved.`
        : `Your after-hours access request for ${existing.date} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      'AFTER_HOURS_ACCESS',
      existing.id
    );

    return NextResponse.json(updated);
  })
);
