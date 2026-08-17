import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseIntegerInput } from '@/lib/queryFilters';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { parseMoneyInput } from '@/lib/money';

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

  // parseFloat('abc') is NaN, which Prisma rejects on a Decimal column as an
  // exception — so a mistyped price answered 500 rather than saying which field
  // was wrong. `tax: parseFloat(tax) || 0` also silently turned a typo into 0,
  // quietly pricing the product with no tax at all.
  const parsedBasePrice = parseMoneyInput(basePrice);
  if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
    throw new ValidationError('Base price must be a non-negative number.');
  }
  const parsedTax = tax === undefined || tax === null || tax === '' ? 0 : parseMoneyInput(tax);
  if (!Number.isFinite(parsedTax) || parsedTax < 0) {
    throw new ValidationError('Tax must be a non-negative number.');
  }
  const parsedQuantity = parseIntegerInput(initialQuantity, 'Opening quantity', { min: 0 }) ?? 0;
  const parsedReorderLevel = parseIntegerInput(reorderLevel, 'Reorder level', { min: 0 });

  const product = await prisma.product.create({
    data: {
      sku, name,
      category: category || null,
      oemName: oemName || null,
      description: description || null,
      basePrice: parsedBasePrice,
      tax: parsedTax,
      isActive: true,
      ...(attributes && { attributes }),
      inventory: {
        create: {
          quantity: parsedQuantity,
          reorderLevel: parsedReorderLevel,
          warehouseLocation: warehouseLocation || null,
        },
      },
    },
    include: { inventory: true },
  });

  return NextResponse.json(product, { status: 201 });
});
