import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { createNotification } from '@/lib/notify';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  if (!['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { status, rejectionReason } = await req.json();

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new ValidationError('Invalid status');
  }

  // First, fetch the original request to get its type
  const originalRequest = await prisma.approvalRequest.findUnique({
    where: { id },
    select: { type: true, entityId: true, leadId: true, requestedBy: true, status: true },
  });

  if (!originalRequest) throw new NotFoundError('Request');

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
  if (user.role === 'BACKEND_TEAM') {
    const subordinates = await prisma.user.findMany({ where: { managerId: user.id }, select: { id: true } });
    const teamIds = [user.id, ...subordinates.map((u) => u.id)];
    if (!teamIds.includes(originalRequest.requestedBy)) throw new ForbiddenError();
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
      await prisma.order.delete({ where: { id: originalRequest.entityId } });
    } else if (originalRequest.type === 'CUSTOMER_DELETE') {
      await prisma.customer.update({
        where: { id: originalRequest.entityId },
        data: { deletedAt: new Date() },
      });
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
