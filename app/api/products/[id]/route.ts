import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      inventory: true,
      vendorProducts: {
        include: {
          vendor: { select: { id: true, vendorName: true, rating: true } },
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ message: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, category, description, basePrice, tax, isActive, attributes } = body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description }),
      ...(basePrice !== undefined && { basePrice: parseFloat(basePrice) }),
      ...(tax !== undefined && { tax: parseFloat(tax) }),
      ...(isActive !== undefined && { isActive }),
      ...(attributes !== undefined && { attributes }),
    },
    include: {
      inventory: true,
      vendorProducts: {
        include: {
          vendor: { select: { id: true, vendorName: true, rating: true } },
        },
      },
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ message: 'Product deactivated' });
}
