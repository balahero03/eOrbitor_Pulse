import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface DecodedToken {
  userId: string;
}

function verifyToken(token: string): DecodedToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedToken;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const followUp = await prisma.followUp.findUnique({
    where: { id: id },
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
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, scheduledDate, actualDate, durationMinutes, notes, outcome, nextAction } = body;

  const followUp = await prisma.followUp.update({
    where: { id: id },
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
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await prisma.followUp.delete({ where: { id: id } });

  return NextResponse.json({ message: 'Follow-up deleted' });
}
