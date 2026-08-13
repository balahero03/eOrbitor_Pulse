import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { createNotification, notifyAdminsAndManagers } from '@/lib/notify';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Same role-scoping rule as the rest of the leads routes: on-field sees only
// their own, backend sees self + their reports, admins see everything.
async function inScope(user: AuthUser, assignedToId: string | null): Promise<boolean> {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return assignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!assignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId);
  }
  return false;
}

const nameOf = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/**
 * Hand a lead's ownership to another user.
 *
 * Admins reassign directly. Everyone else — managers included — files a
 * request that the *receiving* user accepts, so nobody silently inherits work
 * they haven't agreed to. Admins can also decide those requests from the
 * Approvals hub; both paths converge on the same reassignment code below.
 *
 * The target may sit on any team. Scoping restricts which leads you can act on,
 * not who you may hand them to.
 */
export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  // .../api/leads/<id>/transfer
  const segments = req.nextUrl.pathname.split('/');
  const leadId = segments[segments.length - 2];

  const { toUserId, reason } = await req.json();
  if (!toUserId) throw new ValidationError('Pick who the lead should go to.');

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: {
      id: true,
      name: true,
      company: true,
      assignedToId: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!lead) throw new NotFoundError('Lead');
  if (!(await inScope(user, lead.assignedToId))) throw new ForbiddenError();

  if (toUserId === lead.assignedToId) {
    throw new ValidationError('That person already owns this lead.');
  }

  const target = await prisma.user.findFirst({
    where: { id: toUserId, isActive: true, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!target) throw new ValidationError('That user is not available to receive leads.');

  // `AuthUser`'s name fields come from the JWT and are optional, so tokens
  // issued before they were added carry neither. Reading the actor's name from
  // the database keeps "undefined undefined" out of people's notifications.
  const actor = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, lastName: true },
  });
  const actorName = actor ? nameOf(actor) : user.email;

  // One transfer in flight at a time. Without this, two requests could each be
  // accepted and the second would silently undo the first.
  const pending = await prisma.approvalRequest.findFirst({
    where: { leadId, type: 'LEAD_TRANSFER', status: 'PENDING' },
    select: { id: true },
  });
  if (pending) {
    throw new ValidationError('A transfer request for this lead is already awaiting a decision.');
  }

  const leadLabel = `"${lead.name}"${lead.company ? ` (${lead.company})` : ''}`;

  // ── Admins: apply it now ────────────────────────────────────────────────
  if (ADMIN_ROLES.includes(user.role)) {
    const [, transfer] = await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { assignedToId: toUserId } }),
      prisma.leadTransfer.create({
        data: {
          leadId,
          fromUserId: lead.assignedToId,
          toUserId,
          actedById: user.id,
          reason: reason || null,
        },
        include: {
          fromUser: { select: { id: true, firstName: true, lastName: true } },
          toUser: { select: { id: true, firstName: true, lastName: true } },
          actedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'LEAD',
          entityId: leadId,
          leadId,
          changes: { assignedToId: { from: lead.assignedToId, to: toUserId } },
        },
      }),
    ]);

    await createNotification(
      toUserId,
      'LEAD_ASSIGNED',
      'Lead transferred to you',
      `${actorName} transferred ${leadLabel} to you.`,
      'LEAD',
      leadId,
    );
    // The person losing the lead deserves to hear it from the system rather
    // than by noticing it vanish from their list.
    if (lead.assignedToId && lead.assignedToId !== user.id) {
      await createNotification(
        lead.assignedToId,
        'LEAD_ASSIGNED',
        'Lead reassigned',
        `${leadLabel} was transferred to ${nameOf(target)}.`,
        'LEAD',
        leadId,
      );
    }

    return NextResponse.json({ status: 'TRANSFERRED', transfer });
  }

  // ── Everyone else: request the receiver's acceptance ────────────────────
  const request = await prisma.approvalRequest.create({
    data: {
      type: 'LEAD_TRANSFER',
      entityType: 'LEAD',
      entityId: leadId,
      leadId,
      requestedBy: user.id,
      targetUserId: toUserId,
      reason: reason || null,
    },
    include: {
      requestedByUser: { select: { id: true, firstName: true, lastName: true } },
      targetUser: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
  });

  const requesterName = nameOf(request.requestedByUser);

  await createNotification(
    toUserId,
    'APPROVAL_REQUESTED',
    'Lead transfer needs your acceptance',
    `${requesterName} wants to transfer ${leadLabel} to you. Open the lead to accept or decline.`,
    'LEAD',
    leadId,
  );
  await notifyAdminsAndManagers(
    'APPROVAL_REQUESTED',
    'New Lead Transfer Request',
    `${requesterName} requested to transfer ${leadLabel} to ${nameOf(target)}.`,
    'LEAD',
    leadId,
    user.id,
  );

  return NextResponse.json({ status: 'PENDING', request }, { status: 201 });
});
