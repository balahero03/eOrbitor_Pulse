import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const STAGES = ['SUSPECT', 'PROSPECT', 'APPROACH', 'NEGOTIATION', 'CLOSURE', 'ONGOING'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
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
      where: { id: params.id },
      data: { stage: newStage },
    });

    return NextResponse.json(deal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
