import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Mirrors the /api/orders list route's scoping (`deal.assignedToId`). An
// order with no linked deal is only visible to managers/admins — the list
// route already excludes such orders from on-field results, so this keeps
// detail access no more permissive than the list.
async function inScope(user: AuthUser, dealAssignedToId: string | null | undefined): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return !!dealAssignedToId && dealAssignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!dealAssignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(dealAssignedToId);
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      quotation: true,
      deal: true,
    },
  });

  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  return NextResponse.json(order);
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { deal: { select: { assignedToId: true } } },
  });
  if (!existing) throw new NotFoundError('Order');
  if (!(await inScope(user, existing.deal?.assignedToId))) throw new ForbiddenError();

  const body = await req.json();
  const { status, paymentStatus, amountPaid, totalAmount, deliveryDate, poNumber, poDate, paymentMode, paymentRemarks, paymentProofUrl } = body;

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

  const updateData: any = {};

  // Order status otherwise moves through the confirm/fulfill endpoints, which
  // validate each transition (PENDING → CONFIRMED → FULFILLED). Letting this
  // general-purpose PATCH set status directly skipped those checks entirely,
  // so only admins retain that escape hatch here.
  if (status) {
    if (!isAdmin) throw new ForbiddenError('Use the Confirm / Fulfill actions to change order status.');
    updateData.status = status;
  }
  // paymentStatus must reflect actual money collected (amountPaid vs. total)
  // — it's derived automatically below whenever amountPaid changes. Letting
  // it be set directly meant anyone in scope could mark an order COMPLETED
  // without ever recording a payment. Only admins retain a manual override.
  if (paymentStatus) {
    if (!isAdmin) throw new ForbiddenError('Payment status is set automatically from the amount paid.');
    updateData.paymentStatus = paymentStatus;
  }
  if (amountPaid !== undefined) {
    const paid = parseFloat(amountPaid);
    const total = totalAmount !== undefined ? parseFloat(totalAmount) : parseFloat(existing.totalAmount.toString());
    if (!Number.isFinite(paid) || paid < 0) throw new ValidationError('amountPaid must be a non-negative number');
    if (Number.isFinite(total) && paid > total) {
      throw new ValidationError('amountPaid cannot exceed the order total');
    }
    updateData.amountPaid = paid.toString();
    if (Number.isFinite(total)) {
      updateData.paymentStatus = paid >= total && paid > 0 ? 'COMPLETED' : paid > 0 ? 'PARTIAL' : 'PENDING';
    }
  }
  if (totalAmount !== undefined) updateData.totalAmount = parseFloat(totalAmount).toString();
  if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
  if (poNumber !== undefined) updateData.poNumber = poNumber || null;
  if (poDate !== undefined) updateData.poDate = poDate ? new Date(poDate) : null;
  if (paymentMode !== undefined) updateData.paymentMode = paymentMode || null;
  if (paymentRemarks !== undefined) updateData.paymentRemarks = paymentRemarks || null;
  if (paymentProofUrl !== undefined) updateData.paymentProofUrl = paymentProofUrl || null;

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(order);
});

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { deal: { select: { assignedToId: true } } },
  });
  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  // Admins delete immediately; everyone else must go through the existing
  // ORDER_DELETE approval workflow (already wired up in
  // /api/approval-requests/[id]) instead of deleting directly.
  if (ADMIN_ROLES.includes(user.role)) {
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ message: 'Order deleted successfully' });
  }

  const body = await req.json().catch(() => ({}));
  const approvalRequest = await prisma.approvalRequest.create({
    data: {
      type: 'ORDER_DELETE',
      entityType: 'ORDER',
      entityId: id,
      requestedBy: user.id,
      reason: body.reason,
    },
  });

  return NextResponse.json({
    message: 'Deletion request submitted for approval',
    requestId: approvalRequest.id,
  });
});
