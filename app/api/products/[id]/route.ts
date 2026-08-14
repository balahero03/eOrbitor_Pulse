import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

// Creating a product is already admin-only (see ../route.ts). Editing and
// deactivating were left open to any signed-in user, so a field rep could
// silently reprice or retire an item from the shared catalogue — and every
// quotation drawn from it afterwards would carry the change.
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

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

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser, { params }: { params: Promise<{ id: string }> }) => {
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new ForbiddenError('Only admins can edit products');
  }
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

export const DELETE = withAuth(async (_req: NextRequest, user: AuthUser, { params }: { params: Promise<{ id: string }> }) => {
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new ForbiddenError('Only admins can deactivate products');
  }
  const { id } = await params;
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ message: 'Product deactivated' });
});
