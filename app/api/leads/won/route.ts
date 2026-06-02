import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search');

  const where: any = { status: 'ORDER' };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        address: true,
        quoteValue: true,
        closedAt: true,
        linkedCustomerId: true,
      },
      orderBy: { closedAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);

  // Fetch GST numbers from linkedCustomer if available
  const customersWithGst = await Promise.all(
    leads.map(async (lead) => {
      let gstNumber = '';
      if (lead.linkedCustomerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: lead.linkedCustomerId },
          select: { gstNumber: true },
        });
        gstNumber = customer?.gstNumber || '';
      }
      return { ...lead, gstNumber };
    })
  );

  return NextResponse.json({
    customers: customersWithGst,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
