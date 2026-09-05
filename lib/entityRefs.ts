import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';

/**
 * Verify that a record referenced by a request body actually exists, before
 * its id is written into a foreign-key column.
 *
 * Unchecked, these reach Postgres and fail the constraint. Prisma reports
 * that as P2003, and lib/prismaErrors.ts translates it — correctly, but
 * generically — into "This refers to a record that no longer exists." From a
 * form with a customer, a quotation and a deal on it, that names none of them,
 * so the one thing the user needs to know (which selection went stale) is the
 * one thing the message leaves out.
 *
 * A stale id is a normal event rather than an attack: a record deleted in
 * another tab, a dropdown cached since page load, a back-button resubmit.
 * The write is refused either way — nothing here prevents corruption. What it
 * buys is an error that says which record, so the user can fix the right
 * field instead of refreshing and guessing.
 *
 * Soft deletes count as missing wherever the model has `deletedAt`: a
 * soft-deleted customer satisfies the foreign key perfectly well, so without
 * this an order could be attached to a customer nobody can see any more.
 */

type Ref = { id?: string | null; model: 'customer' | 'deal' | 'quotation' | 'lead' | 'order' | 'followUp'; label: string };

// Only these carry a `deletedAt` column. Adding the filter to a model without
// one is not a silent no-op — Prisma rejects the whole query with
// '"deletedAt" is not a field that can be set here', which turns a reference
// check into a 400 on every request that passes through it. Verified against
// the schema rather than assumed: Deal, Quotation and FollowUp have no soft
// delete.
const SOFT_DELETABLE = new Set(['customer', 'lead', 'order']);

/**
 * Check several references at once. Ids that are null/undefined/'' are skipped,
 * so callers can pass optional fields straight through.
 */
export async function assertRefsExist(refs: Ref[]): Promise<void> {
  const present = refs.filter((r) => typeof r.id === 'string' && r.id !== '');
  if (present.length === 0) return;

  // One query per distinct model rather than per reference — an order create
  // carries three of these and should not cost three round trips.
  const byModel = new Map<Ref['model'], Ref[]>();
  for (const r of present) {
    const list = byModel.get(r.model) ?? [];
    list.push(r);
    byModel.set(r.model, list);
  }

  for (const [model, group] of byModel) {
    const ids = [...new Set(group.map((r) => r.id as string))];
    const where: any = { id: { in: ids } };
    // `deletedAt` only exists on some models; adding it blindly would throw a
    // Prisma validation error on the ones without it.
    if (SOFT_DELETABLE.has(model)) where.deletedAt = null;

    const found = await (prisma as any)[model].findMany({ where, select: { id: true } });
    const foundIds = new Set(found.map((f: any) => f.id));

    const missing = group.filter((r) => !foundIds.has(r.id));
    if (missing.length > 0) {
      const labels = [...new Set(missing.map((r) => r.label))];
      // ValidationError (400) rather than NotFoundError (404): the route's own
      // target was found, it is a value inside the body that does not resolve.
      // NotFoundError also appends " not found" to whatever it is given, which
      // would garble a full sentence.
      throw new ValidationError(
        labels.length === 1
          ? `The selected ${labels[0]} no longer exists. Pick another one.`
          : `These no longer exist: ${labels.join(', ')}. Pick them again.`,
      );
    }
  }
}
