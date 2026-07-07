import { prisma } from '@/lib/prisma';

// Human-friendly lead identifier: LD-<year>-<4-digit sequence>, e.g. LD-2026-0001.
// The sequence continues across the whole table (not reset per year) so that a
// lead's quotation numbers (LD-2026-0001-A, -B, …) stay stable and unambiguous.
export async function generateLeadNumber(): Promise<string> {
  const year = new Date().getFullYear();

  // Find the highest existing sequence number across all leads (any year).
  const last = await prisma.lead.findFirst({
    where: { leadNumber: { not: null } },
    orderBy: { leadNumber: 'desc' },
    select: { leadNumber: true },
  });

  let next = 1;
  if (last?.leadNumber) {
    const match = last.leadNumber.match(/LD-\d+-(\d+)/);
    if (match) next = parseInt(match[1], 10) + 1;
  }

  return `LD-${year}-${String(next).padStart(4, '0')}`;
}

// Next quotation number for a lead: appends A, B, C, … to the lead number.
// existingCount = how many quotations the lead already has.
export function leadQuoteNumber(leadNumber: string, existingCount: number): string {
  // 0 → A, 1 → B, … 25 → Z, 26 → AA, 27 → AB, …
  let n = existingCount;
  let suffix = '';
  do {
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${leadNumber}-${suffix}`;
}
