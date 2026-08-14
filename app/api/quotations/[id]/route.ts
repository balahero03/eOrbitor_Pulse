import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

// Mirrors the /api/quotations list route's scoping (by createdById).
async function inScope(user: AuthUser, createdById: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.id === createdById) return true;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(createdById);
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      deal: true,
      createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      orders: { where: { quotationId: id } },
    },
  });

  if (!quotation) throw new NotFoundError('Quotation');
  if (!(await inScope(user, quotation.createdById))) throw new ForbiddenError();

  let leadInfo: { id: string; dealName: string } | null = null;

  if (quotation.deal) {
    leadInfo = { id: quotation.deal.id, dealName: (quotation.deal as any).dealName || (quotation.deal as any).name || (quotation.deal as any).company };
  }

  if (!leadInfo && (quotation.dealId || quotation.leadId)) {
    const targetId = quotation.dealId || quotation.leadId;
    const l = await prisma.lead.findFirst({
      where: { id: targetId!, deletedAt: null },
      select: { id: true, name: true, company: true },
    });
    if (l) {
      leadInfo = { id: l.id, dealName: l.name ? `${l.name} (${l.company})` : l.company };
    } else {
      const d = await prisma.deal.findUnique({ where: { id: targetId! } });
      if (d) {
        leadInfo = { id: d.id, dealName: d.dealName };
      }
    }
  }

  if (!leadInfo && quotation.customerId) {
    const l = await prisma.lead.findFirst({
      where: { linkedCustomerId: quotation.customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, company: true },
    });
    if (l) {
      leadInfo = { id: l.id, dealName: l.name ? `${l.name} (${l.company})` : l.company };
    }
  }

  if (!leadInfo && quotation.customer?.companyName) {
    const l = await prisma.lead.findFirst({
      where: {
        company: { equals: quotation.customer.companyName, mode: 'insensitive' },
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
    ...quotation,
    deal: leadInfo,
  });
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.quotation.findUnique({
    where: { id },
    select: { createdById: true, status: true, discountAmount: true },
  });
  if (!existing) throw new NotFoundError('Quotation');
  if (!(await inScope(user, existing.createdById))) throw new ForbiddenError();

  const body = await req.json();
  const {
    status, notes, items, discountAmount,
    priceValidity, taxDetails, warranty, amcPeriod, deliveryEstimate, paymentTerms,
  } = body;

  // Accepting a quote is a financial approval step with its own endpoint
  // (which also enforces separation of duties) — this generic PATCH must not
  // be usable to set that status directly.
  if (status === 'ACCEPTED') {
    throw new ForbiddenError('Use the Approve action to accept a quotation.');
  }

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  // Once a quote has been sent, its pricing is what the customer saw — only an
  // admin can still correct it after the fact. Drafts stay freely editable.
  if ((items || discountAmount !== undefined) && existing.status !== 'DRAFT' && !isAdmin) {
    throw new ForbiddenError('Only a draft quotation can have its items or pricing edited.');
  }

  let updateData: any = {};

  if (status) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (priceValidity !== undefined) updateData.priceValidity = priceValidity;
  if (taxDetails !== undefined) updateData.taxDetails = taxDetails;
  if (warranty !== undefined) updateData.warranty = warranty;
  if (amcPeriod !== undefined) updateData.amcPeriod = amcPeriod;
  if (deliveryEstimate !== undefined) updateData.deliveryEstimate = deliveryEstimate;
  if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;

  // If items updated, recalculate totals
  if (items && items.length > 0) {
    let subtotal = 0;

    for (const item of items) {
      // Custom/blank line items have no catalog productId — only validate
      // items that actually claim to reference a product.
      if (item.productId) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new ValidationError(`Product ${item.productId} not found`);
        }
      }

      subtotal += item.quantity * item.unitPrice;
    }

    // Quotations are tax-exclusive — GST is not charged on the quote total.
    const discount = discountAmount !== undefined ? Number(discountAmount) : Number(existing.discountAmount);
    const totalAmount = subtotal - discount;

    updateData.items = items;
    updateData.subtotal = subtotal.toString();
    updateData.taxAmount = '0';
    updateData.discountAmount = discount.toString();
    updateData.totalAmount = totalAmount.toString();
    updateData.revision = { increment: 1 };
  }

  const quotation = await prisma.quotation.update({
    where: { id },
    data: updateData,
    include: {
      customer: true,
      deal: true,
      createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      orders: { where: { quotationId: id } },
    },
  });

  return NextResponse.json(quotation);
});

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.quotation.findUnique({ where: { id }, select: { createdById: true, status: true } });
  if (!existing) throw new NotFoundError('Quotation');

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  const isCreator = existing.createdById === user.id;
  if (!isAdmin && !isCreator) throw new ForbiddenError();

  // Once a quote has been sent/accepted/rejected it's part of the deal's
  // record — deleting it would erase that history. Drafts can still be
  // discarded freely.
  if (existing.status !== 'DRAFT' && !isAdmin) {
    throw new ForbiddenError('Only a draft quotation can be deleted — reject it instead.');
  }

  await prisma.quotation.delete({ where: { id } });

  return NextResponse.json({ message: 'Quotation deleted successfully' });
});
