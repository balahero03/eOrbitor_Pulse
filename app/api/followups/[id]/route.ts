import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/auth';

export const GET = withAuth(async (_req: NextRequest, _user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const followUp = await prisma.followUp.findUnique({
    where: { id },
    include: {
      deal: { select: { id: true, dealName: true, customer: { select: { companyName: true } } } },
      lead: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!followUp) {
    return NextResponse.json({ message: 'Follow-up not found' }, { status: 404 });
  }

  return NextResponse.json(followUp);
});

export const PATCH = withAuth(async (req: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: 'Follow-up not found' }, { status: 404 });
  }

  const isCreator = existing.createdById === user.id;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  if (!isCreator && !isAdmin) {
    return NextResponse.json({ message: 'Only the creator or an admin can edit this follow-up' }, { status: 403 });
  }

  const body = await req.json();
  const { type, scheduledDate, actualDate, durationMinutes, notes, outcome, nextAction } = body;

  const followUp = await prisma.followUp.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(scheduledDate !== undefined && { scheduledDate: new Date(scheduledDate) }),
      ...(actualDate !== undefined && { actualDate: actualDate ? new Date(actualDate) : null }),
      ...(durationMinutes !== undefined && { durationMinutes }),
      ...(notes !== undefined && { notes }),
      ...(outcome !== undefined && { outcome }),
      ...(nextAction !== undefined && { nextAction }),
    },
    include: {
      deal: { select: { id: true, dealName: true, customer: { select: { companyName: true } } } },
      lead: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(followUp);
});

export const DELETE = withAuth(async (_req: NextRequest, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: 'Follow-up not found' }, { status: 404 });
  }

  const isCreator = existing.createdById === user.id;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  if (!isCreator && !isAdmin) {
    return NextResponse.json({ message: 'Only the creator or an admin can delete this follow-up' }, { status: 403 });
  }

  await prisma.followUp.delete({ where: { id } });

  return NextResponse.json({ message: 'Follow-up deleted' });
});
