import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';

/**
 * Validate user ids arriving in a request body before they are written to a
 * record's owner fields.
 *
 * `assignedToId`, `broughtById` and `presalesIds[]` were written straight
 * through. Two things went wrong with that:
 *
 *   - An id that matches no user violates the foreign key, which surfaces as a
 *     500 rather than as "that person doesn't exist".
 *   - An id belonging to an ex-employee or a deactivated account satisfies the
 *     foreign key perfectly well. The lead then sits with an owner who is in
 *     nobody's team, so it disappears from every scoped list — its own rep,
 *     their manager, every dashboard count — while still existing in the
 *     database. Admins are the only people who can still see it, and only if
 *     they go looking.
 *
 * `presalesIds` is a plain String[] with no foreign key at all, so a bad id
 * there is never caught by anything.
 */

/** Assert that every supplied id is an active, non-deleted user. */
export async function assertAssignableUsers(
  ids: (string | null | undefined)[],
  label = 'user',
): Promise<void> {
  const wanted = [...new Set(ids.filter((v): v is string => typeof v === 'string' && v !== ''))];
  if (wanted.length === 0) return;

  const found = await prisma.user.findMany({
    where: { id: { in: wanted }, isActive: true, deletedAt: null },
    select: { id: true },
  });

  if (found.length !== wanted.length) {
    const missing = wanted.filter((id) => !found.some((u) => u.id === id));
    throw new ValidationError(
      missing.length === 1
        ? `That ${label} is not an active account, so the record cannot be assigned to them.`
        : `${missing.length} of the selected ${label}s are not active accounts.`,
    );
  }
}
