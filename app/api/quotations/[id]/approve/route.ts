import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/approve')[0].split('/').pop()!;

  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new NotFoundError('Quotation');

  // Approving a quote is a spending-authority decision — it needs a manager
  // or admin, and never the person who created the quote being approved.
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  if (!isAdmin && user.role !== 'BACKEND_TEAM') {
    throw new ForbiddenError('Only a manager or admin can approve a quotation.');
  }
  if (quotation.createdById === user.id) {
    throw new ForbiddenError('You cannot approve a quotation you created yourself.');
  }
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    if (!teamIds.includes(quotation.createdById)) throw new ForbiddenError();
  }
  if (quotation.status === 'ACCEPTED') {
    throw new ValidationError('This quotation has already been accepted.');
  }

  // Update status to ACCEPTED and set approvedAt timestamp
  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: 'ACCEPTED',
      approvedAt: new Date(),
      approvedById: user.id,
    },
    include: {
      customer: { select: { companyName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(updated);
});
