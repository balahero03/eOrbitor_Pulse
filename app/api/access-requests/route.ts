import { NextRequest, NextResponse } from 'next/server';
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

  const isAdmin = ADMIN_ROLES.includes(user.role);
  const where: any = isAdmin ? {} : { userId: user.id };
  if (isAdmin) {
    where.status = status || 'PENDING';
  } else if (status) {
    where.status = status;
  }

  const requests = await prisma.afterHoursAccessRequest.findMany({
    where,
    include: isAdmin ? { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ requests });
});
