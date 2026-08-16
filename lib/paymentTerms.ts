import { istDateString, shiftIstDate, endOfIstDay } from '@/lib/istDate';

// Re-exported: this module's callers already import it from here.
export { endOfIstDay };

/**
 * Credit terms → a payment due date.
 *
 * Terms are captured as free text at lead closure ("Net 30", "50% advance,
 * balance on delivery", "COD"), because that is how the sales team writes
 * them and forcing a dropdown would lose the detail. So this reads a day
 * count out of the text where one is there, and reports `null` where it
 * isn't — an unrecognised term is not an error, it just means the due date
 * has to be set by hand.
 *
 * Deliberately conservative. Guessing a due date wrongly is worse than not
 * setting one: a wrong date puts an order on the overdue list and sends its
 * owner a reminder for money that is not actually late, which is exactly the
 * kind of false alarm that teaches people to ignore the reminders.
 */

/**
 * Day count implied by a terms string, or `null` if none can be read.
 *
 *   "Net 30" / "NET30" / "net 30 days"  → 30
 *   "30 days" / "30d"                   → 30
 *   "Immediate" / "Advance" / "COD"     → 0   (payable now)
 *   "50% advance, balance on delivery"  → null (a schedule, not a single date)
 *   "" / "As agreed"                    → null
 */
export function parsePaymentTermsDays(terms: string | null | undefined): number | null {
  if (!terms) return null;
  const text = terms.trim().toLowerCase();
  if (!text) return null;

  // A split payment describes two or more dates, and this function can only
  // express one. Better to return null and let a human set the date than to
  // pick whichever half matched first.
  //
  // This has to be tested *before* the advance keywords below: "50% advance,
  // balance on delivery" contains "advance", so checking that first read a
  // staged payment as due-in-full-today.
  if (/\d\s*%/.test(text) && /\b(balance|remaining|rest|then|and)\b/.test(text)) {
    return null;
  }

  // Payable up front. Ahead of the numeric patterns so that "100% advance" is
  // read as due-now rather than having its "100" taken as a day count.
  if (/\b(immediate|immediately|advance|prepaid|pre-paid|cod|cash on delivery|on delivery|against delivery)\b/.test(text)) {
    return 0;
  }

  const net = text.match(/\bnet[\s-]*(\d{1,3})\b/);
  if (net) return clampDays(Number(net[1]));

  const days = text.match(/\b(\d{1,3})\s*(?:days?|d)\b/);
  if (days) return clampDays(Number(days[1]));

  return null;
}

/**
 * A term beyond a year is far more likely to be a typo or a figure that isn't
 * a day count at all ("Net 2026") than a real two-year credit line.
 */
function clampDays(n: number): number | null {
  if (!Number.isFinite(n) || n < 0 || n > 365) return null;
  return n;
}

/**
 * The due date for an order, as a `YYYY-MM-DD` IST calendar date.
 *
 * Date arithmetic goes through `shiftIstDate` rather than through a `Date`
 * with `setDate`, so the answer depends only on the calendar and not on
 * whichever timezone the host happens to be in — the same reason the reports
 * and attendance code was moved onto these helpers.
 */
export function derivePaymentDueDateStr(
  terms: string | null | undefined,
  anchor: Date | null | undefined,
): string | null {
  const days = parsePaymentTermsDays(terms);
  if (days === null) return null;
  return shiftIstDate(istDateString(anchor ?? new Date()), days);
}

/**
 * Same, as an instant for Prisma. End of the IST day: the balance is not late
 * until the day it was due has actually finished.
 */
export function derivePaymentDueDate(
  terms: string | null | undefined,
  anchor: Date | null | undefined,
): Date | null {
  const dateStr = derivePaymentDueDateStr(terms, anchor);
  return dateStr ? endOfIstDay(dateStr) : null;
}


/**
 * Whole days a balance is past due — 0 when it is due today or not yet due.
 * Compared as calendar dates so "1 day overdue" means the date has actually
 * turned over, not that 24 hours have elapsed.
 */
export function daysOverdue(dueDate: Date | string | null | undefined, now: Date = new Date()): number {
  if (!dueDate) return 0;
  const due = typeof dueDate === 'string' ? dueDate.slice(0, 10) : istDateString(dueDate);
  const today = istDateString(now);
  if (today <= due) return 0;
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(today) - parse(due)) / 86400000);
}
