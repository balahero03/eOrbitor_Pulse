import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
}

function verifyToken(token: string): DecodedToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedToken;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      products: {
        include: {
          product: { select: { id: true, sku: true, name: true, basePrice: true } },
        },
      },
    },
  });

  if (!vendor) {
    return NextResponse.json({ message: 'Vendor not found' }, { status: 404 });
  }

  return NextResponse.json(vendor);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { vendorName, email, phone, website, paymentTerms, rating, isActive } = body;

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...(vendorName !== undefined && { vendorName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(website !== undefined && { website }),
      ...(paymentTerms !== undefined && { paymentTerms }),
      ...(rating !== undefined && { rating: rating ? parseInt(rating) : null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      products: {
        include: {
          product: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(vendor);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await prisma.vendor.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json({ message: 'Vendor deactivated' });
}
