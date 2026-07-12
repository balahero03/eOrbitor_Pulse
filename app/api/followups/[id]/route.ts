import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const user = verifyToken(token);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

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
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const user = verifyToken(token);
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

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
}
