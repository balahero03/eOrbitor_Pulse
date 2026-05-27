import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedTo: { select: { firstName: true, lastName: true } },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!deal) {
      return NextResponse.json({ message: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json(deal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { dealName, stage, dealValue, winProbability, expectedCloseDate, nextAction, lostReason } = body;

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(dealName && { dealName }),
        ...(stage && { stage }),
        ...(dealValue !== undefined && { dealValue }),
        ...(winProbability !== undefined && { winProbability }),
        ...(expectedCloseDate && { expectedCloseDate: new Date(expectedCloseDate) }),
        ...(nextAction !== undefined && { nextAction }),
        ...(lostReason !== undefined && { lostReason }),
        ...(stage === 'CLOSED_WON' || stage === 'LOST' ? { closedAt: new Date() } : {}),
      },
    });

    return NextResponse.json(deal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    await prisma.deal.delete({ where: { id } });

    return NextResponse.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
