import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');

  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    throw new Error('Invalid token');
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await verifyAuth(req);

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: { customer: true, assignedTo: true, createdBy: true, deal: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json(ticket);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await verifyAuth(req);
    const body = await req.json();

    const { status, priority, assignedToId, resolutionNotes, customerSatisfactionRating } = body;

    const updateData: any = {};

    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED') {
        updateData.resolvedAt = new Date();
      } else if (status === 'CLOSED') {
        updateData.closedAt = new Date();
      }
    }

    if (priority) updateData.priority = priority;
    if (assignedToId) updateData.assignedToId = assignedToId;
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    if (customerSatisfactionRating !== undefined) updateData.customerSatisfactionRating = customerSatisfactionRating;

    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: updateData,
      include: { customer: true, assignedTo: true, createdBy: true },
    });

    return NextResponse.json(ticket);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await verifyAuth(req);

    await prisma.ticket.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Ticket deleted' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}
