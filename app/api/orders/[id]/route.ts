import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { saveBase64Files } from '@/lib/storage';
import { parseMoneyInput } from '@/lib/money';
import { derivePaymentDueDate, endOfIstDay } from '@/lib/paymentTerms';

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

  let order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      quotation: true,
      deal: true,
    },
  });

  if (!order) throw new NotFoundError('Order');
  if (!(await inScope(user, order.deal?.assignedToId))) throw new ForbiddenError();

  // Back-fill a total that was never set, from the linked quotation.
  //
  // Only when the order has *no* payment history. A ₹0 order can be deliberate
  // — a free replacement or a sample — and healing it on every read silently
  // overwrote that. Once money has been recorded the figure is real regardless,
  // and must not be rewritten underneath the ledger.
  const hasLedger = await prisma.orderPayment.count({ where: { orderId: id } });
  if (
    !hasLedger &&
    (order.totalAmount === null || order.totalAmount === undefined || Number(order.totalAmount) === 0) &&
    order.quotation?.totalAmount &&
    Number(order.quotation.totalAmount) > 0
  ) {
    order = await prisma.order.update({
      where: { id },
      data: { totalAmount: order.quotation.totalAmount },
      include: {
        customer: true,
        quotation: true,
        deal: true,
      },
    });
  }

  let leadInfo: { id: string; dealName: string } | null = null;

  if (order.deal) {
    leadInfo = { id: order.deal.id, dealName: (order.deal as any).dealName || (order.deal as any).name || (order.deal as any).company };
  }

  const targetId = order.dealId || (order.quotation as any)?.dealId || (order.quotation as any)?.leadId;
  if (!leadInfo && targetId) {
    const l = await prisma.lead.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, name: true, company: true },
    });
    if (l) {
      leadInfo = { id: l.id, dealName: l.name ? `${l.name} (${l.company})` : l.company };
    } else {
      const d = await prisma.deal.findUnique({ where: { id: targetId } });
      if (d) {
        leadInfo = { id: d.id, dealName: d.dealName };
      }
    }
  }

  if (!leadInfo && order.customerId) {
    const l = await prisma.lead.findFirst({
      where: { linkedCustomerId: order.customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, company: true },
    });
    if (l) {
      leadInfo = { id: l.id, dealName: l.name ? `${l.name} (${l.company})` : l.company };
    }
  }

  if (!leadInfo && order.customer?.companyName) {
    const l = await prisma.lead.findFirst({
      where: {
        company: { equals: order.customer.companyName, mode: 'insensitive' },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, company: true },
    });
    if (l) {
      leadInfo = { id: l.id, dealName: l.name ? `${l.name} (${l.company})` : l.company };
    }
  }

  return NextResponse.json({
    ...order,
    deal: leadInfo,
  });
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
  const { status, paymentStatus, totalAmount, deliveryDate, poNumber, poDate, invoiceNumber, invoiceFile,
          paymentTerms, paymentDueDate } = body;

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
  // `amountPaid` is deliberately NOT accepted here. It is a cached sum of the
  // OrderPayment ledger, so letting this route set it absolutely produced an
  // order showing money that no payment row justified — and the next recorded
  // payment then silently overwrote the typed figure. Money in goes through
  // POST /api/orders/[id]/payments, which is the only writer.

  if (totalAmount !== undefined) {
    const total = parseMoneyInput(totalAmount);
    if (!Number.isFinite(total) || total < 0) {
      throw new ValidationError('Order value must be a non-negative number.');
    }
    // Changing what the order is worth changes whether it counts as paid, so
    // re-derive the status from the ledger rather than leaving a fully-paid
    // order marked COMPLETED after its value is raised.
    const agg = await prisma.orderPayment.aggregate({
      where: { orderId: id },
      _sum: { amount: true },
    });
    const paid = Number(agg._sum.amount ?? 0);
    if (total > 0 && paid > total + 0.001) {
      throw new ValidationError(
        `This order already has ${paid.toLocaleString('en-IN')} recorded against it. Remove a payment before lowering the value below that.`
      );
    }
    updateData.totalAmount = total.toString();
    updateData.paymentStatus = paid <= 0 ? 'PENDING' : paid >= total && total > 0 ? 'COMPLETED' : 'PARTIAL';
  }

  if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber || null;
  if (invoiceFile !== undefined) {
    // Same disk-backed treatment as a payment receipt: only the descriptor is
    // stored, never the bytes.
    if (invoiceFile?.dataBase64 && invoiceFile?.filename) {
      const [stored] = saveBase64Files(`orders/${id}`, [{
        filename: invoiceFile.filename,
        contentType: invoiceFile.contentType,
        dataBase64: invoiceFile.dataBase64,
      }]);
      updateData.invoiceFile = stored ?? null;
    } else if (invoiceFile === null) {
      updateData.invoiceFile = null;
    }
  }
  if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
  if (poNumber !== undefined) updateData.poNumber = poNumber || null;
  if (poDate !== undefined) updateData.poDate = poDate ? new Date(poDate) : null;

  // ── Credit terms and the due date ──────────────────────────────────────────
  //
  // An explicitly supplied date always wins and is never recomputed over: once
  // someone has typed a date, silently moving it because the terms text also
  // changed would overwrite a deliberate decision with a guess.
  //
  // Otherwise the date is re-derived whenever the terms or the PO date they are
  // measured from change — which is what stops the due date going stale the
  // moment its inputs move.
  if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms?.trim() || null;

  if (paymentDueDate !== undefined) {
    updateData.paymentDueDate = paymentDueDate ? endOfIstDay(String(paymentDueDate).slice(0, 10)) : null;
  } else if (paymentTerms !== undefined || poDate !== undefined) {
    const terms = paymentTerms !== undefined ? updateData.paymentTerms : existing.paymentTerms;
    const anchor = poDate !== undefined ? updateData.poDate : existing.poDate;
    const derived = derivePaymentDueDate(terms, anchor ?? existing.createdAt);
    // Only write a derived date when one could actually be read from the terms.
    // Unrecognised terms must not wipe a date that is already there.
    if (derived) updateData.paymentDueDate = derived;
  }
  // paymentMode / paymentRemarks / paymentProofUrl are deliberately not accepted
  // here — the same reasoning as amountPaid above. They are the attributes of a
  // *single* payment, and each one now lives on its OrderPayment row, so
  // setting them on the order let it advertise a mode or a receipt that none of
  // its actual payments agreed with. paymentProofUrl additionally took a base64
  // data URL, which is how ~544 KB of receipt ended up inside a Postgres row
  // before proofs were moved to disk. Payment details go through
  // POST /api/orders/[id]/payments.

  // Must mirror the GET's shape. The detail page does `setOrder(updated)` with
  // whatever this returns, so an order without its `customer` relation replaces
  // a good one in state and the next render throws on `order.customer.companyName`.
  // The confirm/fulfill/payment routes already include it; this one did not.
  const order = await prisma.order.update({
    where: { id },
    data: updateData,
    include: {
      customer: true,
      quotation: true,
      deal: true,
    },
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
