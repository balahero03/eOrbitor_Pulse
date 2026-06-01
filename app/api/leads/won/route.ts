import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';

  const where: any = {
    deletedAt: null,
    status: { in: ['WON', 'ORDER'] },
  };

  if (user.role === 'SALES_EXEC') {
    where.assignedToId = user.id;
  } else if (user.role === 'SALES_MANAGER') {
    const team = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    where.assignedToId = { in: [user.id, ...team.map(u => u.id)] };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    take: 20,
    select: {
      id: true,
      name: true,
      company: true,
      quoteValue: true,
      linkedCustomerId: true,
      linkedCustomer: { select: { id: true, companyName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ leads });
});
