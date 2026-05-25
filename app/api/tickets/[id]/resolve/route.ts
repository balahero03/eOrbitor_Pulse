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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await verifyAuth(req);
    const body = await req.json();
    const { resolutionNotes, customerSatisfactionRating } = body;

    const ticket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || null,
        customerSatisfactionRating: customerSatisfactionRating || null,
      },
      include: { customer: true, assignedTo: true },
    });

    return NextResponse.json(ticket);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to resolve ticket' }, { status: 500 });
  }
}
