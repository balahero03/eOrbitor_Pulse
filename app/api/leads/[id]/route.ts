import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        broughtBy: { select: { id: true, firstName: true, lastName: true } },
        linkedCustomer: { select: { id: true, companyName: true } },
        followUps: { select: { id: true, type: true, scheduledDate: true, outcome: true, notes: true }, take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    // Resolve presalesIds to user names
    let presalesUsers: any[] = [];
    if (lead && lead.presalesIds && lead.presalesIds.length > 0) {
      presalesUsers = await prisma.user.findMany({
        where: { id: { in: lead.presalesIds } },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ ...lead, presalesUsers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const {
      name, email, phone, company, address, source, status, leadScore,
      assignedToId, broughtById, linkedCustomerId, qualificationNotes,
      remarks, quoteNo, quoteValue, rfqDate, followUpDate, expectedClosureDate,
      solutionAreas, oemNames, presalesIds,
    } = body;

    let resolvedCustomerId = linkedCustomerId;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(company !== undefined && { company }),
        ...(address !== undefined && { address }),
        ...(source !== undefined && { source }),
        ...(status !== undefined && { status: status as any }),
        ...(leadScore !== undefined && { leadScore }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(broughtById !== undefined && { broughtById }),
        ...(resolvedCustomerId !== undefined && { linkedCustomerId: resolvedCustomerId }),
        ...(qualificationNotes !== undefined && { qualificationNotes }),
        ...(remarks !== undefined && { remarks }),
        ...(quoteNo !== undefined && { quoteNo }),
        ...(quoteValue !== undefined && quoteValue !== '' && { quoteValue: parseFloat(quoteValue) }),
        ...(rfqDate !== undefined && { rfqDate: rfqDate ? new Date(rfqDate) : null }),
        ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
        ...(expectedClosureDate !== undefined && { expectedClosureDate: expectedClosureDate ? new Date(expectedClosureDate) : null }),
        ...(solutionAreas !== undefined && { solutionAreas }),
        ...(oemNames !== undefined && { oemNames }),
        ...(presalesIds !== undefined && { presalesIds }),
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        linkedCustomer: { select: { id: true, companyName: true } },
      },
    });

    return NextResponse.json(lead);
  } catch (error: any) {
    console.error('[LEAD PATCH ERROR]', error?.message, error?.code, error?.meta);
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret') as any;

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const approvalRequest = await prisma.approvalRequest.create({
      data: {
        type: 'LEAD_DELETE',
        entityType: 'LEAD',
        entityId: id,
        requestedBy: decoded.id,
        reason,
      },
      include: {
        lead: { select: { name: true, company: true } },
      },
    });

    return NextResponse.json({
      message: 'Deletion request submitted for approval',
      requestId: approvalRequest.id,
    }, { status: 202 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
