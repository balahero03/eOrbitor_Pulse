import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search');

  const where: any = {};

  if (search) {
    where.product = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const skip = (page - 1) * limit;
  const [inventory, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, basePrice: true, category: true } },
      },
      orderBy: { product: { name: 'asc' } },
      skip,
      take: limit,
    }),
    prisma.inventory.count({ where }),
  ]);

  return NextResponse.json({
    inventory,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { productId, quantityChange, warehouseLocation } = await req.json();

  if (!productId || !quantityChange) {
    return NextResponse.json({ message: 'productId and quantityChange are required' }, { status: 400 });
  }

  const inventory = await prisma.inventory.findUnique({ where: { productId } });
  if (!inventory) {
    return NextResponse.json({ message: 'Inventory not found' }, { status: 404 });
  }

  const newQuantity = inventory.quantity + parseInt(quantityChange);
  if (newQuantity < 0) {
    return NextResponse.json({ message: 'Insufficient stock' }, { status: 400 });
  }

  const updated = await prisma.inventory.update({
    where: { productId },
    data: {
      quantity: newQuantity,
      ...(warehouseLocation && { warehouseLocation }),
      ...(quantityChange > 0 && { lastRestockDate: new Date(), lastRestockQuantity: quantityChange }),
    },
    include: { product: { select: { id: true, sku: true, name: true } } },
  });

  return NextResponse.json(updated);
});
