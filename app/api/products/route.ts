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
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const isActive = searchParams.get('isActive') !== 'false';

  const where: any = { isActive };
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        inventory: { select: { quantity: true, reorderLevel: true, warehouseLocation: true, lastRestockDate: true } },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    products,
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
  const { sku, name, category, description, basePrice, tax, initialQuantity, reorderLevel, warehouseLocation } = body;

  if (!sku || !name || !basePrice) {
    return NextResponse.json({ message: 'SKU, name, and basePrice are required' }, { status: 400 });
  }

  const existingSku = await prisma.product.findUnique({ where: { sku } });
  if (existingSku) {
    return NextResponse.json({ message: 'SKU already exists' }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      sku,
      name,
      category: category || null,
      description: description || null,
      basePrice: parseFloat(basePrice),
      tax: parseFloat(tax) || 0,
      isActive: true,
      inventory: {
        create: {
          quantity: initialQuantity ? parseInt(initialQuantity) : 0,
          reorderLevel: reorderLevel ? parseInt(reorderLevel) : null,
          warehouseLocation: warehouseLocation || null,
        },
      },
    },
    include: {
      inventory: true,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
