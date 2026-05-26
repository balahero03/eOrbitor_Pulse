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

  const task = await prisma.task.findUnique({
    where: { id: id },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      relatedDeal: { select: { id: true, dealName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ message: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, status, priority, dueDate, assignedToId, relatedDealId, tags, completedAt } = body;

  const task = await prisma.task.update({
    where: { id: id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(assignedToId !== undefined && { assignedToId }),
      ...(relatedDealId !== undefined && { relatedDealId: relatedDealId || null }),
      ...(tags !== undefined && { tags }),
      ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      relatedDeal: { select: { id: true, dealName: true } },
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await prisma.task.delete({ where: { id: id } });

  return NextResponse.json({ message: 'Task deleted' });
}
