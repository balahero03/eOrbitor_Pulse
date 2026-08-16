import { NextRequest, NextResponse } from 'next/server';
import { parseEnumParam } from '@/lib/queryFilters';
import { ApprovalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { checkAccessGate, currentNightDate } from '@/lib/accessControl';
import { createNotification } from '@/lib/notify';
import { ValidationError } from '@/lib/errors';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { reason } = await req.json();
  if (!reason || !String(reason).trim()) {
    throw new ValidationError('A reason is required');
  }

  // Never trust a client-supplied date — derive tonight's restricted window
  // from the live policy, and confirm the caller is actually gated right now.
  const gate = await checkAccessGate(user.role, user.id);
  if (!gate.blocked) {
    throw new ValidationError('You are not currently restricted — no request needed.');
  }

  const existingPending = await prisma.afterHoursAccessRequest.findFirst({
    where: { userId: user.id, date: gate.date, status: 'PENDING' },
  });
  if (existingPending) {
    return NextResponse.json({ message: 'A request for tonight is already pending' }, { status: 409 });
  }

  const request = await prisma.afterHoursAccessRequest.create({
    data: { userId: user.id, date: gate.date, reason: String(reason).trim() },
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES as any }, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      createNotification(
        a.id,
        'APPROVAL_REQUESTED',
        'After-Hours Access Request',
        `${user.email} is requesting after-hours CRM access for tonight.`,
        'AFTER_HOURS_ACCESS',
        request.id
      )
    )
  );

  return NextResponse.json(request, { status: 201 });
});

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const typeFilter = searchParams.get('type');
  const id = searchParams.get('id');

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role);
  const baseWhere: any = isAdmin ? {} : { userId: user.id };
  if (id) {
    baseWhere.id = id;
  } else if (status && status !== 'ALL') {
    // Same enum column as the record approvals, so the same guard: an
    // unrecognised value reached Prisma and came back as a 500.
    baseWhere.status = parseEnumParam(status, ApprovalStatus, 'access request status');
  } else if (isAdmin && !status) {
    baseWhere.status = 'PENDING';
  }

  const includeUser = isAdmin ? { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } } : undefined;

  let afterHoursRequests: any[] = [];
  let unlockRequests: any[] = [];

  if (!typeFilter || typeFilter === 'AFTER_HOURS') {
    afterHoursRequests = await prisma.afterHoursAccessRequest.findMany({
      where: baseWhere,
      include: includeUser,
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!typeFilter || typeFilter === 'ACTIVITY_UNLOCK') {
    unlockRequests = await prisma.activityUnlockRequest.findMany({
      where: baseWhere,
      include: includeUser,
      orderBy: { createdAt: 'desc' },
    });
  }

  const combined = [
    ...afterHoursRequests.map((r) => ({ ...r, requestType: 'AFTER_HOURS' as const })),
    ...unlockRequests.map((r) => ({ ...r, requestType: 'ACTIVITY_UNLOCK' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ requests: combined });
});
