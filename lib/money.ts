/**
 * Parse a money figure typed by a user into a number, or NaN if there isn't one.
 *
 * Callers should gate on `Number.isFinite(...)` and simply not write the field
 * when it comes back NaN. Returning NaN rather than throwing keeps "the user
 * left this alone" and "the user typed something that isn't a number" on the
 * same, harmless path.
 *
 * Three inputs this exists to get right, each of which was a live bug:
 *
 *   "1,25,000"  → 125000   `parseFloat` stops at the first comma and returns 1,
 *                          so Indian-grouped figures were silently truncated to
 *                          a fraction of what was entered.
 *   "nil" / null→ NaN      Free text and null used to reach Prisma as NaN, which
 *                          it drops from the payload — producing the misleading
 *                          "Argument `dealValue` is missing" that broke the
 *                          Negotiation stage.
 *   "" / "   "  → NaN      An empty box means "not provided", not zero. `Number('')`
 *                          is 0, so parsing it naively would quietly overwrite a
 *                          real quote value with nothing.
 */
export function parseMoneyInput(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;

  // Strip grouping separators and spaces, but nothing else: a stray currency
  // symbol or stray letters should fail the parse rather than be guessed at.
  const cleaned = value.replace(/[,\s]/g, '');
  if (cleaned === '') return NaN;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Coerce anything to a finite number for display, defaulting to 0.
 *
 * `Intl.NumberFormat.format(NaN)` renders the literal string "₹NaN", and
 * `parseFloat(undefined)` / `parseFloat('')` both produce NaN — so any list
 * row with a missing amount printed "₹NaN" straight into the UI.
 */
export function toFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}
