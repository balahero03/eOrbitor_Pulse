import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(lead);
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
    const { name, email, phone, company, source, status, leadScore, assignedToId, broughtById, linkedCustomerId, qualificationNotes, remarks, quoteNo, quoteValue, rfqDate, followUpDate } = body;

    // Auto-convert to customer when status advances to a positive stage
    const CUSTOMER_STAGES = ['PROSPECT', 'NEGOTIATION', 'WON'];
    let resolvedCustomerId = linkedCustomerId;

    if (status && CUSTOMER_STAGES.includes(status) && !linkedCustomerId) {
      const existing = await prisma.lead.findUnique({ where: { id }, select: { linkedCustomerId: true, company: true } });
      if (existing && !existing.linkedCustomerId) {
        try {
          const customer = await prisma.customer.create({
            data: {
              companyName: existing.company,
              gstNumber: `PENDING-${Date.now()}`,
              industry: 'Other',
            },
          });
          resolvedCustomerId = customer.id;
        } catch {
          // customer may already exist — continue without linking
        }
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(company && { company }),
        ...(source && { source }),
        ...(status && { status }),
        ...(leadScore !== undefined && { leadScore }),
        ...(assignedToId && { assignedToId }),
        ...(broughtById !== undefined && { broughtById }),
        ...(resolvedCustomerId && { linkedCustomerId: resolvedCustomerId }),
        ...(qualificationNotes !== undefined && { qualificationNotes }),
        ...(remarks !== undefined && { remarks }),
        ...(quoteNo !== undefined && { quoteNo }),
        ...(quoteValue !== undefined && quoteValue !== '' && { quoteValue: parseFloat(quoteValue) }),
        ...(rfqDate !== undefined && { rfqDate: rfqDate ? new Date(rfqDate) : null }),
        ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        linkedCustomer: { select: { id: true, companyName: true } },
      },
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
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

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
