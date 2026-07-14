import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { notifyAdminsAndManagers } from '@/lib/notify';

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
  const id = req.nextUrl.pathname.split('/send')[0].split('/').pop()!;

  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new NotFoundError('Quotation');
  if (!(await inScope(user, quotation.createdById))) throw new ForbiddenError();

  // Update status to SENT and set sentAt timestamp
  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
    include: {
      customer: { select: { companyName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  // A non-admin creator's "send" is really a request for a manager/admin's
  // sign-off (self-approval is blocked) — let them know there's something
  // to review. An admin sending their own quote is already final, no ping needed.
  const isCreatorAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(updated.createdBy.role);
  if (!isCreatorAdmin) {
    await notifyAdminsAndManagers(
      'APPROVAL_REQUESTED',
      'Quotation awaiting approval',
      `${updated.createdBy.firstName} ${updated.createdBy.lastName} requested approval for quotation ${updated.quotationNumber} (${updated.customer.companyName}).`,
      'QUOTATION',
      id,
      user.id,
    );
  }

  return NextResponse.json(updated);
});
