import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

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

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
  const search = searchParams.get('search');

  let where: any = {};

  if (lowStockOnly) {
    where = {
      AND: [
        { quantity: { gt: 0 } },
        { reorderLevel: { not: null } },
        { quantity: { lte: prisma.inventory.fields.reorderLevel } },
      ],
    };
  }

  if (search) {
    where.product = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [inventory, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, basePrice: true, category: true } },
      },
      orderBy: { product: { name: 'asc' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inventory.count({ where }),
  ]);

  return NextResponse.json({
    inventory,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { productId, quantityChange, reason, warehouseLocation } = body;

  if (!productId || !quantityChange) {
    return NextResponse.json({ message: 'productId and quantityChange are required' }, { status: 400 });
  }

  const inventory = await prisma.inventory.findUnique({
    where: { productId },
  });

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
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}
