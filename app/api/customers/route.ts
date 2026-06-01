import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search');
  const industry = searchParams.get('industry');

  const where: any = { deletedAt: null };

  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { industry: { contains: search, mode: 'insensitive' } },
      { contacts: { some: { email: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (industry) where.industry = industry;

  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, companyName: true, industry: true, website: true,
        annualRevenue: true, customerCategory: true, createdAt: true,
        _count: { select: { deals: true, contacts: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  const data = customers.map((c) => ({
    id: c.id, companyName: c.companyName, industry: c.industry,
    website: c.website, annualRevenue: c.annualRevenue,
    customerCategory: c.customerCategory, createdAt: c.createdAt,
    activeDealCount: c._count.deals,
    contactCount: c._count.contacts,
  }));

  return NextResponse.json({
    customers: data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { companyName, industry, website, annualRevenue, gstNumber, yearEstablished } = await req.json();

  if (!companyName) {
    return NextResponse.json({ message: 'Company name is required' }, { status: 400 });
  }
  if (!gstNumber) {
    return NextResponse.json({ message: 'GST number is required' }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: {
      companyName,
      gstNumber: gstNumber.trim(),
      industry: industry || 'Other',
      website: website || null,
      annualRevenue: annualRevenue || null,
      yearEstablished: yearEstablished || null,
    },
  });

  return NextResponse.json(customer, { status: 201 });
});
