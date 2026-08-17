import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

/**
 * Scope checks for the approval workflow.
 *
 * The workflow exists so that a destructive action is reviewed by someone
 * senior rather than performed silently. That only holds if both halves are
 * anchored to the record: filing a request had no check that the requester
 * could see the target at all, and deciding one checked only that the
 * *requester* was in the approver's team — never the record.
 *
 * Together those composed into a way to destroy data across team boundaries:
 * a rep files ORDER_DELETE against an order id belonging to another team (ids
 * surface through several shared screens), their own manager sees a request
 * from their own report and approves it, and the order is gone. Neither person
 * had any right to that record, and every individual check passed.
 */

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/** The owner a record is scoped by, or `undefined` if the record is gone. */
async function ownerOf(
  entityType: string,
  entityId: string,
): Promise<{ ownerId: string | null } | undefined> {
  if (entityType === 'LEAD') {
    const lead = await prisma.lead.findUnique({
      where: { id: entityId },
      select: { assignedToId: true, deletedAt: true },
    });
    // A reopen request legitimately targets an already-deleted lead, so
    // deletedAt is not disqualifying here — existence is what matters.
    return lead ? { ownerId: lead.assignedToId } : undefined;
  }
  if (entityType === 'ORDER') {
    const order = await prisma.order.findUnique({
      where: { id: entityId },
      select: { deletedAt: true, deal: { select: { assignedToId: true } } },
    });
    if (!order || order.deletedAt) return undefined;
    return { ownerId: order.deal?.assignedToId ?? null };
  }
  if (entityType === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({
      where: { id: entityId },
      select: { deletedAt: true },
    });
    if (!customer || customer.deletedAt) return undefined;
    // Customers are company-wide master data — every role lists them — so
    // there is no owner to scope by. Deciding one is restricted to admins
    // instead, in canDecide below.
    return { ownerId: null };
  }
  return undefined;
}

/** Whether `user` may act on a record owned by `ownerId`. */
async function inScope(
  role: string,
  userId: string,
  ownerId: string | null,
): Promise<boolean> {
  if (ADMIN_ROLES.includes(role)) return true;
  if (ownerId === null) return true; // unowned master data (customers)
  if (role === 'ON_FIELD_TEAM') return ownerId === userId;
  if (role === 'BACKEND_TEAM') {
    const team = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    return [userId, ...team.map((u) => u.id)].includes(ownerId);
  }
  return false;
}

/**
 * Assert that `user` may file a request against this record.
 *
 * Also confirms the record exists, which nothing did before — a request could
 * be filed against any string, and only surfaced later as a failure while an
 * admin was trying to approve it.
 */
export async function assertCanRequest(
  user: { id: string; role: string },
  entityType: string,
  entityId: string,
): Promise<void> {
  const target = await ownerOf(entityType, entityId);
  if (!target) throw new NotFoundError(entityType.toLowerCase());
  if (!(await inScope(user.role, user.id, target.ownerId))) {
    throw new ForbiddenError('You do not have access to that record.');
  }
}

/**
 * Assert that `user` may decide an already-filed request.
 *
 * Order and customer deletions are admin-only. They are org-level records —
 * an order carries the invoice and the payment ledger, a customer is shared
 * master data — and neither is scoped to a team, so a team manager has no
 * basis on which to authorise destroying one.
 */
export async function assertCanDecide(
  user: { id: string; role: string },
  type: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  if (type === 'ORDER_DELETE' || type === 'CUSTOMER_DELETE') {
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenError('Only an admin can approve this request.');
    }
    return;
  }

  const target = await ownerOf(entityType, entityId);
  // A lead request whose target has since vanished is decided on the request
  // alone — refusing here would leave it stuck pending forever.
  if (!target) return;
  if (!(await inScope(user.role, user.id, target.ownerId))) {
    throw new ForbiddenError('You do not have access to that record.');
  }
}
