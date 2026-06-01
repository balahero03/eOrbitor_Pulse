import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');

  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
  } catch {
    throw new Error('Invalid token');
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await verifyAuth(req);

    const ticket = await prisma.ticket.findUnique({
      where: { id: id },
      include: { customer: true, assignedTo: true, createdBy: true, deal: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Permission check: User can view if they:
    // - Are SUPER_ADMIN or ADMIN (view all)
    // - Are SUPPORT and assigned to this ticket
    // - Created the ticket (view own)
    const canView =
      ['SUPER_ADMIN', 'ADMIN'].includes(user.role) ||
      (user.role === 'SUPPORT' && ticket.assignedToId === user.id) ||
      ticket.createdById === user.id;

    if (!canView) {
      return NextResponse.json(
        { error: 'You do not have permission to view this ticket' },
        { status: 403 }
      );
    }

    return NextResponse.json(ticket);
  } catch (err: any) {
    if (err.message === 'You do not have permission to view this ticket') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await verifyAuth(req);

    const ticket = await prisma.ticket.findUnique({
      where: { id: id },
      select: { assignedToId: true, createdById: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Permission check: User can edit if they:
    // - Are SUPER_ADMIN or ADMIN
    // - Are SUPPORT and assigned to this ticket
    // - Created the ticket (can only view, not edit)
    const canEdit =
      ['SUPER_ADMIN', 'ADMIN'].includes(user.role) ||
      (user.role === 'SUPPORT' && ticket.assignedToId === user.id);

    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this ticket' },
        { status: 403 }
      );
    }

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

    const updatedTicket = await prisma.ticket.update({
      where: { id: id },
      data: updateData,
      include: { customer: true, assignedTo: true, createdBy: true },
    });

    return NextResponse.json(updatedTicket);
  } catch (err: any) {
    if (err.message?.includes('permission')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await verifyAuth(req);

    // Only ADMIN can delete tickets
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Only administrators can delete tickets' },
        { status: 403 }
      );
    }

    await prisma.ticket.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Ticket deleted' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}
