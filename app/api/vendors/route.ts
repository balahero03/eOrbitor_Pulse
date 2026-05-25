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

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
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

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: {
        products: {
          select: { productId: true },
        },
      },
      orderBy: { vendorName: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vendor.count({ where }),
  ]);

  return NextResponse.json({
    vendors,
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
  const { vendorName, gstNumber, email, phone, website, paymentTerms, rating } = body;

  if (!vendorName || !gstNumber) {
    return NextResponse.json({ message: 'Vendor name and GST number are required' }, { status: 400 });
  }

  const existingGst = await prisma.vendor.findUnique({ where: { gstNumber } });
  if (existingGst) {
    return NextResponse.json({ message: 'GST number already exists' }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      vendorName,
      gstNumber,
      email: email || null,
      phone: phone || null,
      website: website || null,
      paymentTerms: paymentTerms || null,
      rating: rating ? parseInt(rating) : null,
      isActive: true,
    },
  });

  return NextResponse.json(vendor, { status: 201 });
}
