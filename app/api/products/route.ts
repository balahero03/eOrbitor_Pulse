import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch } from '@/lib/queryFilters';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const category = searchParams.get('category');
  const search = sanitizeSearch(searchParams.get('search'));
  const isActive = searchParams.get('isActive') !== 'false';

  const where: any = { isActive };
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { oemName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        inventory: { select: { quantity: true, reorderLevel: true, warehouseLocation: true, lastRestockDate: true } },
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    products,
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError('Only admins can create products');
  }

  const { sku, name, category, oemName, description, basePrice, tax, initialQuantity, reorderLevel, warehouseLocation, attributes } = await req.json();

  if (!sku || !name || !basePrice) {
    return NextResponse.json({ message: 'SKU, name, and basePrice are required' }, { status: 400 });
  }

  const existingSku = await prisma.product.findUnique({ where: { sku } });
  if (existingSku) {
    return NextResponse.json({ message: 'SKU already exists' }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      sku, name,
      category: category || null,
      oemName: oemName || null,
      description: description || null,
      basePrice: parseFloat(basePrice),
      tax: parseFloat(tax) || 0,
      isActive: true,
      ...(attributes && { attributes }),
      inventory: {
        create: {
          quantity: initialQuantity ? parseInt(initialQuantity) : 0,
          reorderLevel: reorderLevel ? parseInt(reorderLevel) : null,
          warehouseLocation: warehouseLocation || null,
        },
      },
    },
    include: { inventory: true },
  });

  return NextResponse.json(product, { status: 201 });
});
