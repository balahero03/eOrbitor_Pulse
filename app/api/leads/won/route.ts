import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch } from '@/lib/queryFilters';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const search = sanitizeSearch(searchParams.get('search'));

  // `deletedAt: null` matters as much as the scoping below: this route filtered
  // on status alone, so a lead that had been deleted still came back here and
  // reappeared on the Customers page after being removed everywhere else.
  const where: any = { status: 'ORDER', deletedAt: null };

  // Role-based data scoping — the same rule as /api/leads and /api/leads/closed,
  // which this route never had. Without it every signed-in user, including the
  // lowest-privilege ON_FIELD_TEAM role, could read the company's entire won
  // book: customer name, address, phone, the deal's quoteValue and the linked
  // customer's GST number. It is not a theoretical hole either — the Customers
  // page calls this endpoint on load, so every rep was already being served the
  // whole company's closed business.
  if (user.role === 'ON_FIELD_TEAM') {
    where.assignedToId = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    const team = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    where.assignedToId = { in: [user.id, ...team.map((u) => u.id)] };
  }
  // ADMIN/SUPER_ADMIN see all — no extra filter

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

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
        // Joined here rather than fetched per row. This used to be a
        // findUnique inside a leads.map(), i.e. one extra round trip per lead —
        // 201 queries to render the default page of 200.
        linkedCustomer: { select: { gstNumber: true } },
      },
      orderBy: { closedAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);

  const customersWithGst = leads.map(({ linkedCustomer, ...lead }) => ({
    ...lead,
    gstNumber: linkedCustomer?.gstNumber || '',
  }));

  return NextResponse.json({
    customers: customersWithGst,
    pagination: paginationMeta(page, limit, total),
  });
});
