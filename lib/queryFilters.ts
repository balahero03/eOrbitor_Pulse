import { ValidationError } from '@/lib/errors';

/**
 * Validate the `?status=`, `?search=` and `?fromDate=` style filters a list
 * route accepts, before they reach Prisma.
 *
 * Every one of these went straight into a `where` clause. Prisma rejects what
 * it cannot use, the rejection is an exception, and the route answered 500 —
 * so a filter value nobody had thought about turned a list page into a server
 * error. Swept across 23 endpoints with hostile values, 21 requests came back
 * 5xx in three distinct shapes, each fixed by one of the helpers here:
 *
 *   ?status=NOT_A_STATUS   "Invalid value for argument `status`. Expected
 *                          LeadStatus." — also ?source=, ?priority=,
 *                          ?paymentStatus=
 *   ?search=%00            Postgres refuses a NUL byte inside a text value and
 *                          drops the query. Reached 13 endpoints — every list
 *                          with a search box.
 *   ?fromDate=xx           `new Date('xx')` is an Invalid Date, which Prisma
 *                          reports as "Provided Date object is invalid".
 *
 * The reports routes already validated their dates this way; the list routes
 * never did. Same reasoning as lib/pagination.ts — one implementation, so a
 * new route gets it right by using it.
 */

/**
 * Clean a free-text search term, or `undefined` when there is nothing to search
 * for.
 *
 * Control characters are stripped rather than rejected. A search box is free
 * text, and the user who pasted something with a stray NUL or newline in it
 * wants results for the visible part — not an error telling them their
 * clipboard was malformed.
 */
export function sanitizeSearch(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // C0 controls and DEL. \x00 is the one Postgres refuses outright ("invalid
  // byte sequence"); the rest cannot match anything useful and would only
  // confuse a LIKE pattern.
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned === '' ? undefined : cleaned;
}

/**
 * Check a filter value against a Prisma enum, or `undefined` when absent.
 *
 * The enum object is taken from `@prisma/client` at the call site rather than
 * a hand-written list, so it cannot drift from the schema.
 *
 * Rejects rather than ignoring. Silently dropping an unrecognised filter
 * returns the *unfiltered* list, which looks like a working page showing wrong
 * results — worse than being told the filter was not understood. The valid
 * values are not a secret; they are the options in the UI's own dropdown.
 */
export function parseEnumParam<T extends Record<string, string>>(
  raw: string | null | undefined,
  allowed: T,
  label: string,
): T[keyof T] | undefined {
  if (!raw) return undefined;
  const values = Object.values(allowed) as string[];
  if (!values.includes(raw)) {
    throw new ValidationError(`"${raw}" is not a valid ${label}. Expected one of: ${values.join(', ')}.`);
  }
  return raw as T[keyof T];
}

/** Parse a date filter, or `undefined` when absent. Rejects an unparseable one. */
export function parseDateParam(
  raw: string | null | undefined,
  label: string,
): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`"${raw}" is not a valid ${label}.`);
  }
  return d;
}

/**
 * Parse a numeric filter (a min/max bound), or `undefined` when absent.
 *
 * The gap `parseFloat` left: it returns NaN for free text and Infinity for
 * "1e999", and both go on to reach Prisma, which rejects them as an invalid
 * argument — a 500 from a query string. `Number()` rather than `parseFloat`
 * so "12abc" is rejected outright instead of quietly becoming 12.
 */
export function parseNumberParam(
  raw: string | null | undefined,
  label: string,
): number | undefined {
  if (raw === null || raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`"${raw}" is not a valid ${label}.`);
  }
  return n;
}
