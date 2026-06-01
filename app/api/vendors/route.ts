import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search');
  const isActive = searchParams.get('isActive') !== 'false';

  const where: any = { isActive };
  if (search) {
    where.OR = [
      { vendorName: { contains: search, mode: 'insensitive' } },
      { gstNumber: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: { products: { select: { productId: true } } },
      orderBy: { vendorName: 'asc' },
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where }),
  ]);

  return NextResponse.json({
    vendors,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError('Only admins can create vendors');
  }

  const { vendorName, gstNumber, email, phone, website, paymentTerms, rating } = await req.json();

  if (!vendorName || !gstNumber) {
    return NextResponse.json({ message: 'Vendor name and GST number are required' }, { status: 400 });
  }

  const existingGst = await prisma.vendor.findUnique({ where: { gstNumber } });
  if (existingGst) {
    return NextResponse.json({ message: 'GST number already exists' }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      vendorName, gstNumber,
      email: email || null, phone: phone || null, website: website || null,
      paymentTerms: paymentTerms || null,
      rating: rating ? parseInt(rating) : null,
      isActive: true,
    },
  });

  return NextResponse.json(vendor, { status: 201 });
});
