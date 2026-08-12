import { prisma } from '@/lib/prisma';

// Human-friendly lead identifier: LD-<year>-<4-digit sequence>, e.g. LD-2026-0001.
// The sequence continues across the whole table (not reset per year) so that a
// lead's quotation numbers (QT-2026-0001-A, -B, …) stay stable and unambiguous.

const LEAD_NUMBER_RE = /^LD-(\d{4})-(\d+)$/;

/** Sequence portion of a lead number, or 0 if it isn't one. */
export function leadNumberSequence(value: string | null | undefined): number {
  if (!value) return 0;
  const m = value.match(LEAD_NUMBER_RE);
  return m ? parseInt(m[2], 10) : 0;
}

export function formatLeadNumber(sequence: number, year = new Date().getFullYear()): string {
  return `LD-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Highest sequence currently issued.
 *
 * This used to be `findFirst({ orderBy: { quoteNo: 'desc' } })`, which sorts
 * *lexicographically*. Once any value beginning with a letter after "L" was
 * present — a "QT-…" quotation number imported into the same column — that row
 * won the sort forever. The generator then re-derived the same sequence from it
 * on every call and handed an identical number to every new lead. Ordering has
 * to be numeric on the parsed sequence, so the field is read and reduced here
 * rather than sorted in SQL.
 */
async function highestSequence(): Promise<number> {
  const rows = await prisma.lead.findMany({
    where: { leadNumber: { not: null } },
    select: { leadNumber: true },
  });
  return rows.reduce((max, r) => Math.max(max, leadNumberSequence(r.leadNumber)), 0);
}

/**
 * Next free lead number.
 *
 * `attempt` bumps the sequence so a caller can retry after a unique-constraint
 * collision. Generation is read-then-write and therefore still racy on its own;
 * the `@unique` index on Lead.leadNumber is what actually guarantees no two
 * leads share a number, and `createLeadNumber` below turns a collision into a
 * retry instead of a failed request.
 */
export async function generateLeadNumber(attempt = 0): Promise<string> {
  return formatLeadNumber((await highestSequence()) + 1 + attempt);
}

/**
 * Create a record with a freshly-issued lead number, retrying on collision.
 *
 * Wraps the insert rather than just handing back a string, because the gap
 * between "work out the next number" and "use it" is exactly where two
 * concurrent requests collide. Prisma raises P2002 on the unique index; that is
 * the signal to re-derive from current state and go again.
 */
export async function createWithLeadNumber<T>(
  create: (leadNumber: string) => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const leadNumber = await generateLeadNumber(attempt);
    try {
      return await create(leadNumber);
    } catch (err: any) {
      const isDuplicateLeadNumber =
        err?.code === 'P2002' &&
        (err?.meta?.target === undefined ||
          String(err.meta.target).includes('leadNumber'));
      if (!isDuplicateLeadNumber || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error('Could not allocate a unique lead number');
}

// Next quotation number for a lead: appends A, B, C, … to the lead number.
// existingCount = how many quotations the lead already has.
export function leadQuoteNumber(leadNumber: string, existingCount: number): string {
  // replace prefix EO-LD, EO-QT, LD or MOCK with QT
  let base = leadNumber
    .replace('EO-LD', 'QT')
    .replace('EO-QT', 'QT')
    .replace('LD', 'QT')
    .replace('MOCK', 'QT');

  // ensure no duplicate 'QT-QT' occurs
  base = base.replace('QT-QT', 'QT');

  // 0 → A, 1 → B, … 25 → Z, 26 → AA, 27 → AB, …
  let n = existingCount;
  let suffix = '';
  do {
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${base}-${suffix}`;
}
