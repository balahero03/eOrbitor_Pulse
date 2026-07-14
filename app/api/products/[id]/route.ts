import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/auth';

export const GET = withAuth(async (_req: NextRequest, _user, { params }: { params: Promise<{ id: string }> }) => {
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
});

export const PATCH = withAuth(async (req: NextRequest, _user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json();
  const { name, category, oemName, description, basePrice, tax, isActive, attributes } = body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(oemName !== undefined && { oemName }),
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
});

export const DELETE = withAuth(async (_req: NextRequest, _user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ message: 'Product deactivated' });
});
