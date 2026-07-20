import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, assignedToId: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return assignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId);
  }
  return false;
}

// Matches the Prisma DealStage enum exactly — the previous list used
// "PROPOSAL", which isn't a real stage, so moving a deal there always
// crashed with a database error; the real APPROACH stage was unreachable.
const STAGES = ['SUSPECT', 'PROSPECT', 'APPROACH', 'NEGOTIATION', 'CLOSURE', 'ONGOING'];

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/move')[0].split('/').pop()!;

  const body = await req.json();
  const { newStage } = body;

  if (!STAGES.includes(newStage)) {
    throw new ValidationError('Invalid stage');
  }

  const existing = await prisma.deal.findUnique({ where: { id }, select: { assignedToId: true, stage: true } });
  if (!existing) throw new NotFoundError('Deal');
  if (!(await inScope(user, existing.assignedToId))) throw new ForbiddenError();

  const currentIdx = STAGES.indexOf(existing.stage);
  const newIdx = STAGES.indexOf(newStage);
  const isNextStage = newIdx === currentIdx + 1;
  const isAllowedReversal = existing.stage === 'CLOSURE' && newStage === 'NEGOTIATION';
  const isSkipNegotiation = ((existing.stage as string) === 'PROPOSAL' || existing.stage === 'APPROACH') && (newStage === 'CLOSURE' || newStage === 'ONGOING');

  if (!isNextStage && !isAllowedReversal && !isSkipNegotiation) {
    const nextStage = currentIdx >= 0 && currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : 'end of pipeline';
    throw new ValidationError(`Cannot skip stages. From ${existing.stage}, you must move to ${nextStage}. No stage skipping allowed.`);
  }

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      stage: newStage,
      ...(newStage === 'CLOSURE' || newStage === 'ONGOING' ? { closedAt: new Date() } : {}),
    },
  });

  return NextResponse.json(deal);
});
