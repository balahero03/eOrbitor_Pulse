import { prisma } from '@/lib/prisma';

// Human-friendly order identifier: ORD-<year>-<5-digit sequence>,
// e.g. ORD-2026-00117. Mirrors lib/leadNumber.ts deliberately — same
// derive-then-retry shape, because the same race exists here.

const ORDER_NUMBER_RE = /^ORD-(\d{4})-(\d+)$/;

/** Sequence portion of an order number, or 0 if it isn't one. */
export function orderNumberSequence(value: string | null | undefined): number {
  if (!value) return 0;
  const m = value.match(ORDER_NUMBER_RE);
  return m ? parseInt(m[2], 10) : 0;
}

export function formatOrderNumber(sequence: number, year = new Date().getFullYear()): string {
  return `ORD-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Highest sequence currently issued.
 *
 * Replaces `prisma.order.count() + 1`, which was wrong in two separate ways:
 *
 *   - Deleting any order lowers the count, so the next create re-issues a
 *     number that already exists on an older row.
 *   - Two concurrent creates both read the same count and both derive the
 *     same number.
 *
 * Either way the insert hit the `@unique` index on `orderNumber` and threw an
 * unhandled P2002, so order creation simply failed. Reading the maximum issued
 * sequence removes the delete problem; the retry below covers the race.
 *
 * Read and reduced in JS rather than sorted in SQL because `ORD-2026-00009`
 * sorts after `ORD-2026-00100` lexicographically once the digit count changes.
 */
async function highestSequence(): Promise<number> {
  const rows = await prisma.order.findMany({ select: { orderNumber: true } });
  return rows.reduce((max, r) => Math.max(max, orderNumberSequence(r.orderNumber)), 0);
}

/**
 * Next free order number. `attempt` bumps the sequence so a caller can retry
 * after a unique-constraint collision.
 */
export async function generateOrderNumber(attempt = 0): Promise<string> {
  return formatOrderNumber((await highestSequence()) + 1 + attempt);
}

/**
 * Create an order with a freshly-issued number, retrying on collision.
 *
 * Wraps the insert rather than just returning a string, because the gap between
 * "work out the next number" and "use it" is exactly where two concurrent
 * requests collide. The unique index is what actually guarantees uniqueness;
 * this turns its P2002 into a retry instead of a failed request.
 */
export async function createWithOrderNumber<T>(
  create: (orderNumber: string) => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderNumber = await generateOrderNumber(attempt);
    try {
      return await create(orderNumber);
    } catch (err: any) {
      const isDuplicateOrderNumber =
        err?.code === 'P2002' &&
        (err?.meta?.target === undefined ||
          String(err.meta.target).includes('orderNumber'));
      if (!isDuplicateOrderNumber || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error('Could not allocate a unique order number');
}
