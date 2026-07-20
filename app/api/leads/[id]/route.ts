import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Whether `user` may view or act on a lead assigned to `assignedToId`, using
// the same role-scoping rule as the leads list route: on-field sees only
// their own, backend sees self + their reports, admins see everything.
async function inScope(user: AuthUser, assignedToId: string | null): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return assignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!assignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId);
  }
  return false;
}

export const GET = withAuth(async (_req: NextRequest, user: AuthUser) => {
  const id = _req.nextUrl.pathname.split('/').pop()!;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      broughtBy: { select: { id: true, firstName: true, lastName: true } },
      linkedCustomer: { select: { id: true, companyName: true } },
      followUps: { select: { id: true, type: true, scheduledDate: true, outcome: true, notes: true }, take: 10, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!lead || lead.deletedAt) throw new NotFoundError('Lead');
  if (!(await inScope(user, lead.assignedToId))) throw new ForbiddenError();

  let presalesUsers: any[] = [];
  if (lead.presalesIds && lead.presalesIds.length > 0) {
    presalesUsers = await prisma.user.findMany({
      where: { id: { in: lead.presalesIds } },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  return NextResponse.json({ ...lead, presalesUsers });
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existingLead = await prisma.lead.findUnique({
    where: { id },
    select: { status: true, assignedToId: true, deletedAt: true },
  });
  if (!existingLead || existingLead.deletedAt) throw new NotFoundError('Lead');
  if (!(await inScope(user, existingLead.assignedToId))) throw new ForbiddenError();

  const body = await req.json();
  const {
    name, email, phone, company, address, source, status, leadScore,
    assignedToId, broughtById, linkedCustomerId, qualificationNotes,
    remarks, quoteNo, quoteValue, rfqDate, followUpDate, expectedClosureDate,
    solutionAreas, oemNames, presalesIds, prospectDetails, closureDetails,
  } = body;

  // ON_FIELD_TEAM cannot change core identity fields
  const isOnField = user.role === 'ON_FIELD_TEAM';
  if (isOnField && (name !== undefined || company !== undefined)) {
    throw new ForbiddenError('On-field team members cannot edit the lead name or company.');
  }
  // Reassignment is a manager/admin action — without this an on-field rep
  // could set assignedToId to themselves and take over any lead they can PATCH.
  if (isOnField && assignedToId !== undefined && assignedToId !== existingLead.assignedToId) {
    throw new ForbiddenError('On-field team members cannot reassign leads.');
  }

  let resolvedCustomerId = linkedCustomerId;

  // Enforce sequential pipeline progression
  // ON_HOLD and DROPPED can be set from any pipeline stage — skip sequential validation
  if (status && status !== 'ON_HOLD' && status !== 'DROPPED') {
    const current = existingLead.status;
    const getStageIndex = (s: string) => {
      if (s === 'SUSPECT') return 0;
      if (s === 'PROSPECT') return 1;
      if (s === 'PROPOSAL' || s === 'APPROACH') return 2;
      if (s === 'NEGOTIATION') return 3;
      if (s === 'CLOSURE' || s === 'WON' || s === 'LOST') return 4;
      return -1;
    };

    const currentIdx = getStageIndex(current || '');
    const newIdx = getStageIndex(status);

    // Only allow moving to the next stage or allowed reversals (CLOSURE ↔ NEGOTIATION)
    const allowedReversals = [
      { from: 'CLOSURE', to: 'NEGOTIATION' },
      { from: 'NEGOTIATION', to: 'CLOSURE' },
    ];

    const isAllowedReversal = allowedReversals.some(r => r.from === current && r.to === status);
    const isNextStage = newIdx === currentIdx + 1 || (currentIdx === newIdx && (status === 'PROPOSAL' || status === 'APPROACH'));
    const isSkipNegotiation = (current === 'PROPOSAL' || current === 'APPROACH') && (status === 'CLOSURE' || status === 'WON' || status === 'LOST');

    if (!isAllowedReversal && !isNextStage && !isSkipNegotiation) {
      const stageNames = ['SUSPECT', 'PROSPECT', 'PROPOSAL', 'NEGOTIATION', 'CLOSURE'];
      const nextStage = currentIdx >= 0 && currentIdx < stageNames.length - 1
        ? stageNames[currentIdx + 1]
        : 'end of pipeline';
      throw new ValidationError(`Cannot skip stages. From ${current}, you must move to ${nextStage}. No stage skipping allowed.`);
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(company !== undefined && { company }),
      ...(address !== undefined && { address }),
      ...(source !== undefined && { source }),
      ...(status !== undefined && { status: status as any }),
      ...(leadScore !== undefined && { leadScore }),
      ...(assignedToId !== undefined && { assignedToId }),
      ...(broughtById !== undefined && { broughtById }),
      ...(resolvedCustomerId !== undefined && { linkedCustomerId: resolvedCustomerId }),
      ...(qualificationNotes !== undefined && { qualificationNotes }),
      ...(remarks !== undefined && { remarks }),
      ...(quoteNo !== undefined && { quoteNo }),
      ...(quoteValue !== undefined && quoteValue !== '' && { quoteValue: parseFloat(quoteValue) }),
      ...(rfqDate !== undefined && { rfqDate: rfqDate ? new Date(rfqDate) : null }),
      ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
      ...(expectedClosureDate !== undefined && { expectedClosureDate: expectedClosureDate ? new Date(expectedClosureDate) : null }),
      ...(solutionAreas !== undefined && { solutionAreas }),
      ...(oemNames !== undefined && { oemNames }),
      ...(presalesIds !== undefined && { presalesIds }),
      ...(prospectDetails !== undefined && { closureDetails: prospectDetails }),
      ...(closureDetails !== undefined && prospectDetails === undefined && { closureDetails }),
    },
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
      linkedCustomer: { select: { id: true, companyName: true } },
    },
  });

  // Keep the lead's backing Deal (auto-created for pipeline reporting — see
  // leads/[id]/followups) in sync with the quote value. Deal.dealValue is
  // otherwise stuck at its initial 0 forever, which silently breaks the
  // dashboard's Pipeline Value figure.
  if (quoteValue !== undefined && quoteValue !== '') {
    await prisma.deal.updateMany({
      where: { leadId: id },
      data: { dealValue: parseFloat(quoteValue) },
    });
  }

  return NextResponse.json(lead);
});

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { assignedToId: true, deletedAt: true, name: true },
  });
  if (!lead || lead.deletedAt) throw new NotFoundError('Lead');
  if (!(await inScope(user, lead.assignedToId))) throw new ForbiddenError();

  const body = await req.json().catch(() => ({}));
  const { reason } = body;

  // Admins (SUPER_ADMIN / ADMIN) can delete leads immediately — no approval needed.
  if (ADMIN_ROLES.includes(user.role)) {
    const updated = await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({
      message: 'Lead deleted successfully',
      lead: { id: updated.id, name: updated.name },
    }, { status: 200 });
  }

  // Non-admins must go through the approval workflow.
  const approvalRequest = await prisma.approvalRequest.create({
    data: {
      type: 'LEAD_DELETE',
      entityType: 'LEAD',
      entityId: id,
      leadId: id,
      requestedBy: user.id,
      reason,
    },
    include: {
      lead: { select: { name: true, company: true } },
    },
  });

  return NextResponse.json({
    message: 'Deletion request submitted for approval',
    requestId: approvalRequest.id,
  }, { status: 200 });
});
