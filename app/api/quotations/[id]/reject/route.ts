import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, createdById: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.id === createdById) return true;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(createdById);
  }
  return false;
}

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/reject')[0].split('/').pop()!;

  const body = await req.json();
  const { rejectionReason } = body;

  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new NotFoundError('Quotation');
  if (!(await inScope(user, quotation.createdById))) throw new ForbiddenError();

  // Update status to REJECTED and set rejectionReason field
  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: rejectionReason || '',
    },
    include: {
      customer: { select: { companyName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(updated);
});
