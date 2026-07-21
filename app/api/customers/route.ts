import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ValidationError } from '@/lib/errors';

const CATEGORIES = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'LOST'];

// List real Customer records (manually created / converted), paginated + searchable.
export const GET = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search')?.trim();

  const where: any = { deletedAt: null };

  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { gstNumber: { contains: search, mode: 'insensitive' } },
      { contacts: { some: { name: { contains: search, mode: 'insensitive' } } } },
      { contacts: { some: { email: { contains: search, mode: 'insensitive' } } } },
      { contacts: { some: { phone: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({
    customers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// Create an existing customer (company-centric Customer + primary Contact).
export const POST = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const body = await req.json();
  const {
    companyName,
    gstNumber,
    industry,
    website,
    annualRevenue,
    yearEstablished,
    customerCategory = 'ACTIVE',
    billingAddress,
    shippingAddress,
    contactName,
    contactEmail,
    contactPhone,
    contactDesignation,
  } = body;

  if (!companyName || !companyName.trim()) {
    throw new ValidationError('Company name is required');
  }
  if (!gstNumber || !gstNumber.trim()) {
    throw new ValidationError('GST number is required');
  }
  if (!contactName || !contactName.trim()) {
    throw new ValidationError('Primary contact name is required');
  }
  if (!contactEmail || !contactEmail.trim()) {
    throw new ValidationError('Primary contact email is required');
  }
  if (customerCategory && !CATEGORIES.includes(customerCategory)) {
    throw new ValidationError('Invalid customer category');
  }

  const existing = await prisma.customer.findUnique({
    where: { gstNumber: gstNumber.trim() },
  });
  if (existing) {
    throw new ValidationError('A customer with this GST number already exists');
  }

  const year = yearEstablished ? parseInt(yearEstablished, 10) : null;

  const customer = await prisma.customer.create({
    data: {
      companyName: companyName.trim(),
      gstNumber: gstNumber.trim(),
      industry: industry?.trim() || null,
      website: website?.trim() || null,
      annualRevenue: annualRevenue ? annualRevenue.toString() : null,
      yearEstablished: year && !Number.isNaN(year) ? year : null,
      customerCategory,
      billingAddress: billingAddress?.trim() ? { street: billingAddress.trim() } : undefined,
      shippingAddress: shippingAddress?.trim() ? { street: shippingAddress.trim() } : undefined,
      contacts: {
        create: {
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone?.trim() || null,
          designation: contactDesignation?.trim() || null,
          isPrimary: true,
        },
      },
    },
    include: { contacts: true },
  });

  return NextResponse.json(customer, { status: 201 });
});
