import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { notifyAdminsAndManagers } from '@/lib/notify';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

/**
 * Turn an accepted quotation into an order in one step.
 *
 * Everything the order needs is already on the quotation — customer, value,
 * line items, the originating lead — so nothing here is re-entered. The order
 * keeps a link back to the quotation, which is what lets the order page show
 * where its figure came from.
 */
export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  // .../api/quotations/<id>/convert-to-order
  const segments = req.nextUrl.pathname.split('/');
  const quotationId = segments[segments.length - 2];

  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      totalAmount: true,
      customerId: true,
      leadId: true,
      customer: { select: { id: true, companyName: true } },
    },
  });
  if (!quotation) throw new NotFoundError('Quotation');

  // Quotation.leadId is a plain column with no relation on the model, so the
  // owning lead has to be read separately rather than included above.
  const lead = quotation.leadId
    ? await prisma.lead.findUnique({
        where: { id: quotation.leadId },
        select: { assignedToId: true },
      })
    : null;

  // Scope on the originating lead's owner, matching how quotations are listed.
  const ownerId = lead?.assignedToId ?? null;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  let allowed = isAdmin;
  if (!allowed && user.role === 'ON_FIELD_TEAM') allowed = ownerId === user.id;
  if (!allowed && user.role === 'BACKEND_TEAM') {
    allowed = !!ownerId && (await getTeamIds(user.id)).includes(ownerId);
  }
  if (!allowed) throw new ForbiddenError();

  if (quotation.status !== 'ACCEPTED') {
    throw new ValidationError(
      `Only an accepted quotation becomes an order. ${quotation.quotationNumber} is ${quotation.status}.`
    );
  }

  // One order per quotation — converting twice would double-count the same
  // revenue and leave two orders chasing one payment.
  const existing = await prisma.order.findFirst({
    where: { quotationId },
    select: { id: true, orderNumber: true },
  });
  if (existing) {
    throw new ValidationError(
      `${quotation.quotationNumber} is already on order ${existing.orderNumber}.`
    );
  }

  const total = Number(quotation.totalAmount);
  if (!Number.isFinite(total) || total <= 0) {
    throw new ValidationError('This quotation has no value to convert.');
  }

  const dealForOrder = quotation.leadId
    ? await prisma.deal.findFirst({
        where: { leadId: quotation.leadId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
    : null;

  const orderCount = await prisma.order.count();
  const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: quotation.customerId,
      quotationId: quotation.id,
      dealId: dealForOrder?.id ?? null,
      totalAmount: total.toString(),
      amountPaid: '0',
      status: 'PENDING',
      paymentStatus: 'PENDING',
    },
    include: { customer: true, quotation: true, deal: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'CREATE',
      entityType: 'ORDER',
      entityId: order.id,
      changes: { fromQuotation: quotation.quotationNumber, totalAmount: total },
    },
  });

  await notifyAdminsAndManagers(
    'ORDER_CONFIRMED',
    'Order created from quotation',
    `${orderNumber} was created from ${quotation.quotationNumber} for ${quotation.customer.companyName}.`,
    'ORDER',
    order.id,
    user.id,
  );

  return NextResponse.json(order, { status: 201 });
});
