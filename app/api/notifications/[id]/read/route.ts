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

    const notification = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json(notification);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}
