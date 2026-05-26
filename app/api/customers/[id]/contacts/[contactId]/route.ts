import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  try {
    const { contactId } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { name, email, phone, designation, isPrimary } = body;

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(designation !== undefined && { designation }),
        ...(isPrimary !== undefined && { isPrimary }),
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  try {
    const { contactId } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    await prisma.contact.delete({ where: { id: contactId } });

    return NextResponse.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
