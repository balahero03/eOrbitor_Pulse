import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


const STAGES = ['SUSPECT', 'PROSPECT', 'PROPOSAL', 'NEGOTIATION', 'CLOSURE', 'ONGOING'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { newStage } = body;

    if (!STAGES.includes(newStage)) {
      return NextResponse.json({ message: 'Invalid stage' }, { status: 400 });
    }

    const deal = await prisma.deal.update({
      where: { id: id },
      data: { stage: newStage },
    });

    return NextResponse.json(deal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
