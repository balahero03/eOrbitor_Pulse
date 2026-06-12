import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError } from '@/lib/errors';

export function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (_req: NextRequest, _user: AuthUser) => {
    const { id } = await ctx.params;

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        orders: { orderBy: { createdAt: 'desc' } },
        quotations: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) throw new NotFoundError('Customer');

    return NextResponse.json(customer);
  })(req);
}
