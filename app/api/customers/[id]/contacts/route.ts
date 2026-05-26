import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const contacts = await prisma.contact.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { name, email, phone, designation, isPrimary } = body;

    if (!name || !email) {
      return NextResponse.json({ message: 'Name and email are required' }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        customerId: id,
        name,
        email,
        phone: phone || null,
        designation: designation || null,
        isPrimary: isPrimary || false,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
