/**
 * Parse `?page=` / `?limit=` off a list request.
 *
 * Every list endpoint used to inline this:
 *
 *   const page  = parseInt(searchParams.get('page') || '1');
 *   const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
 *   const skip  = (page - 1) * limit;
 *
 * which trusts the caller for both values. Three inputs broke it, each of them
 * reachable by anyone who can edit a URL:
 *
 *   ?page=abc   parseInt → NaN, so skip is NaN. Prisma rejects the query and
 *               the route returns 500.
 *   ?page=0     skip becomes -20. Prisma refuses a negative skip outright
 *               ("Value can only be positive, found: -20") — again a 500.
 *   ?limit=-5   Math.min(-5, 100) is -5, and a *negative* take is legal in
 *               Prisma: it means "take from the other end". The request
 *               succeeded with a 200 and quietly returned a different set of
 *               rows than the same request with limit=5, alongside a
 *               nonsensical `pages: -17` in the response.
 *
 * Clamping here rather than at each call site keeps the fifteen list routes
 * from having to re-derive the same three edge cases, and means a new route
 * gets it right by using the helper.
 */
export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Read an integer query param, falling back when it is absent, non-numeric, or
 * not a whole finite number. `parseInt` is deliberately not used: it accepts
 * leading garbage ("12abc" → 12) and stops at the first non-digit, so "1e9"
 * parses as 1 — a silent wrong answer rather than a rejected one.
 */
function readInt(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : fallback;
}

export function parsePagination(
  searchParams: URLSearchParams,
  opts: { defaultLimit?: number; maxLimit?: number } = {}
): Pagination {
  const { defaultLimit = 20, maxLimit = 100 } = opts;

  // Out-of-range values are clamped rather than rejected. A caller asking for
  // page 0 or a limit of 500 has made a harmless mistake and wants a list; a
  // 400 in response to a bookmarked URL would be a worse experience than the
  // first page, and the previous behaviour — a 500 — was worse than both.
  const page = Math.max(1, readInt(searchParams.get('page'), 1));
  const limit = Math.min(Math.max(1, readInt(searchParams.get('limit'), defaultLimit)), maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

/** The `pagination` block every list response returns alongside its rows. */
export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
