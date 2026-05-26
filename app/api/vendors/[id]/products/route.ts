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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { productId, vendorSku, vendorPrice, leadTime, minimumOrder } = body;

  if (!productId || !vendorSku || !vendorPrice) {
    return NextResponse.json(
      { message: 'productId, vendorSku, and vendorPrice are required' },
      { status: 400 }
    );
  }

  const existingLink = await prisma.vendorProduct.findUnique({
    where: { vendorId_productId: { vendorId: id, productId } },
  });

  if (existingLink) {
    return NextResponse.json({ message: 'Product already linked to this vendor' }, { status: 400 });
  }

  const vendorProduct = await prisma.vendorProduct.create({
    data: {
      vendorId: id,
      productId,
      vendorSku,
      vendorPrice: parseFloat(vendorPrice),
      leadTime: leadTime ? parseInt(leadTime) : null,
      minimumOrder: minimumOrder ? parseInt(minimumOrder) : null,
    },
    include: {
      product: { select: { id: true, sku: true, name: true, basePrice: true } },
      vendor: { select: { id: true, vendorName: true } },
    },
  });

  return NextResponse.json(vendorProduct, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return NextResponse.json({ message: 'productId is required' }, { status: 400 });
  }

  await prisma.vendorProduct.delete({
    where: { vendorId_productId: { vendorId: id, productId } },
  });

  return NextResponse.json({ message: 'Product removed from vendor' });
}
