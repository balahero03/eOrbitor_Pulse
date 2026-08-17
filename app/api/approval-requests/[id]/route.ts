import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { createNotification } from '@/lib/notify';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { assertCanDecide } from '@/lib/approvalScope';

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const { status, rejectionReason } = await req.json();

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ValidationError('Invalid status');
  }

  // First, fetch the original request to get its type
  const originalRequest = await prisma.approvalRequest.findUnique({
    where: { id },
    select: { type: true, entityType: true, entityId: true, leadId: true, requestedBy: true, status: true, targetUserId: true },
  });

  if (!originalRequest) throw new NotFoundError('Request');

  // A lead transfer is also decidable by the person being handed the lead —
  // they are the one agreeing to take the work on. Every other request type
  // stays admin/manager-only, and admins can still decide transfers from the
  // Approvals hub.
  const isTransferTarget =
    originalRequest.type === 'LEAD_TRANSFER' && originalRequest.targetUserId === user.id;

  if (!isTransferTarget && !['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role)) {
    throw new ForbiddenError();
  }

  // A request can only be decided once — otherwise re-PATCHing an already
  // approved request would re-run its action (e.g. delete the lead again).
  if (originalRequest.status !== 'PENDING') {
    throw new ValidationError(`This request was already ${originalRequest.status.toLowerCase()}.`);
  }

  // Nobody approves their own request — that defeats the point of a review step.
  if (originalRequest.requestedBy === user.id) {
    throw new ForbiddenError('You cannot approve or reject your own request.');
  }

  // A Backend Team manager may only decide requests filed by themselves or
  // their own reports — mirrors the GET list route's team scoping, which
  // this PATCH previously ignored entirely.
  //
  // Skipped when they are the transfer's recipient: a lead may be handed
  // across teams, and the person being given it must be able to answer
  // regardless of which team the sender belongs to.
  if (user.role === 'BACKEND_TEAM' && !isTransferTarget) {
    const subordinates = await prisma.user.findMany({ where: { managerId: user.id }, select: { id: true } });
    const teamIds = [user.id, ...subordinates.map((u) => u.id)];
    if (!teamIds.includes(originalRequest.requestedBy)) throw new ForbiddenError();
  }

  // …and that the *record* is theirs to decide on, not just the requester.
  // Checking only the requester meant a manager approving a request from their
  // own report authorised whatever id that report had put in it, including one
  // belonging to another team entirely. Order and customer deletions are
  // admin-only here for the same reason — see lib/approvalScope.ts.
  if (!isTransferTarget) {
    await assertCanDecide(user, originalRequest.type, originalRequest.entityType, originalRequest.entityId);
  }

  // Update the approval status
  const approvalRequest = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: status as any,
      approvedBy: user.id,
      rejectionReason: status === 'REJECTED' ? rejectionReason : null,
    },
    include: {
      requestedByUser: { select: { id: true, firstName: true, lastName: true } },
      targetUser: { select: { id: true, firstName: true, lastName: true } },
      lead: { select: { id: true, name: true, company: true } },
      approvedByUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Process the approval action
  if (status === 'APPROVED') {
    if (originalRequest.type === 'LEAD_DELETE' && originalRequest.leadId) {
      await prisma.lead.update({
        where: { id: originalRequest.leadId },
        data: { deletedAt: new Date() },
      });
    } else if (originalRequest.type === 'LEAD_REOPEN' && originalRequest.leadId) {
      await prisma.lead.update({
        where: { id: originalRequest.leadId },
        data: { deletedAt: null, status: 'SUSPECT' },
      });
    } else if (originalRequest.type === 'ORDER_DELETE') {
      // Soft delete, like every other approved deletion here. This was the one
      // branch that destroyed the row, cascading through OrderPayment and
      // taking the order's receipt ledger with it.
      await prisma.order.update({
        where: { id: originalRequest.entityId },
        data: { deletedAt: new Date() },
      });
    } else if (originalRequest.type === 'CUSTOMER_DELETE') {
      await prisma.customer.update({
        where: { id: originalRequest.entityId },
        data: { deletedAt: new Date() },
      });
    } else if (originalRequest.type === 'LEAD_TRANSFER' && originalRequest.leadId && originalRequest.targetUserId) {
      // Re-read the owner inside the decision rather than trusting the value
      // captured when the request was filed — an admin may have reassigned the
      // lead in the meantime, and the history must record who actually lost it.
      const current = await prisma.lead.findUnique({
        where: { id: originalRequest.leadId },
        select: { assignedToId: true },
      });
      if (current && current.assignedToId !== originalRequest.targetUserId) {
        await prisma.$transaction([
          prisma.lead.update({
            where: { id: originalRequest.leadId },
            data: { assignedToId: originalRequest.targetUserId },
          }),
          prisma.leadTransfer.create({
            data: {
              leadId: originalRequest.leadId,
              fromUserId: current.assignedToId,
              toUserId: originalRequest.targetUserId,
              actedById: user.id,
              viaApprovalId: id,
              reason: approvalRequest.reason || null,
            },
          }),
          prisma.activityLog.create({
            data: {
              userId: user.id,
              action: 'UPDATE',
              entityType: 'LEAD',
              entityId: originalRequest.leadId,
              leadId: originalRequest.leadId,
              changes: {
                assignedToId: { from: current.assignedToId, to: originalRequest.targetUserId },
                viaApprovalId: id,
              },
            },
          }),
        ]);

        // The new owner is told even when they accepted it themselves — the
        // notification doubles as the audit trail entry they can search later.
        await createNotification(
          originalRequest.targetUserId,
          'LEAD_ASSIGNED',
          'Lead transferred to you',
          `You now own "${approvalRequest.lead?.name ?? 'a lead'}".`,
          'LEAD',
          originalRequest.leadId,
        );
        if (current.assignedToId && current.assignedToId !== user.id) {
          await createNotification(
            current.assignedToId,
            'LEAD_ASSIGNED',
            'Lead reassigned',
            `"${approvalRequest.lead?.name ?? 'A lead'}" was transferred to another owner.`,
            'LEAD',
            originalRequest.leadId,
          );
        }
      }
    }
  }

  // Notify the requester
  const approverName = `${approvalRequest.approvedByUser?.firstName ?? ''} ${approvalRequest.approvedByUser?.lastName ?? ''}`.trim();
  const leadLabel = approvalRequest.lead ? ` for "${approvalRequest.lead.name}"` : '';
  const typeLabel: Record<string, string> = {
    LEAD_DELETE: 'lead deletion',
    LEAD_REOPEN: 'lead reopen',
    ORDER_DELETE: 'order deletion',
    CUSTOMER_DELETE: 'customer deletion',
    LEAD_TRANSFER: 'lead transfer',
  };
  const label = typeLabel[originalRequest.type] || originalRequest.type.toLowerCase();
  const notifyEntityType = originalRequest.type.startsWith('ORDER')
    ? 'ORDER'
    : originalRequest.type.startsWith('CUSTOMER')
    ? 'CUSTOMER'
    : 'LEAD';

  if (status === 'APPROVED') {
    await createNotification(
      approvalRequest.requestedByUser.id ?? '',
      'APPROVAL_APPROVED',
      'Request Approved',
      `Your ${label} request${leadLabel} was approved by ${approverName}.`,
      notifyEntityType,
      originalRequest.entityId,
    );
  } else {
    await createNotification(
      approvalRequest.requestedByUser.id ?? '',
      'APPROVAL_REJECTED',
      'Request Rejected',
      `Your ${label} request${leadLabel} was rejected by ${approverName}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      notifyEntityType,
      originalRequest.entityId,
    );
  }

  return NextResponse.json(approvalRequest);
});
