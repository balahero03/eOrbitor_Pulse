/**
 * Calendar dates in the timezone the business actually runs in.
 *
 * Attendance keys off a `YYYY-MM-DD` string (`DailyActivity` is unique on
 * `(userId, date)`), and every place that needed "which day is it" reached for
 * `new Date().toISOString().slice(0, 10)`. That is the *UTC* date, not the
 * local one, and India is UTC+05:30 — so from midnight to 05:30 IST the app
 * believes it is still yesterday.
 *
 * What that broke, evaluated against the real expressions at 02:15 IST on
 * 2026-08-15 (20:45Z on the 14th):
 *
 *   - `POST /api/daily-activity` rejected the employee's own current day with
 *     400 "Cannot log future dates", because the guard compared their date
 *     (2026-08-15) against a UTC "today" of 2026-08-14.
 *   - `POST /api/auth/login` stamped the login's `DailyActivity` row and its
 *     `TimeLog` under 2026-08-14 — an early start was filed as attendance for
 *     the previous day, which is HR data nobody would think to go and check.
 *   - The unlock request endpoint refused the same day for the same reason.
 *   - Inside the same handler the two checks disagreed: `isWithinEditWindow`
 *     used the *server's local* midnight while the future-date guard used UTC,
 *     so on a host configured with TZ=Asia/Kolkata one said editable and the
 *     other said future.
 *
 * `lib/accessControl.ts` already resolved this correctly for the after-hours
 * window; this puts the same rule everywhere else that asks the question.
 *
 * Safe on the client as well as the server — `Intl` is available in both, and
 * pinning the zone explicitly means a laptop left on another timezone still
 * agrees with the server about which working day it is.
 */
const IST_TZ = 'Asia/Kolkata';

/**
 * The `YYYY-MM-DD` calendar date of an instant, in IST.
 *
 * `en-CA` is used because its short date format *is* ISO order (2026-08-15),
 * so no reassembly from parts is needed.
 */
export function istDateString(when: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(when);
}

/** Today's date in IST, as `YYYY-MM-DD`. */
export function istToday(): string {
  return istDateString();
}

/**
 * Shift a `YYYY-MM-DD` string by whole days without going through a local-time
 * `Date`, where a DST-shifted or offset host could land on the wrong day.
 */
export function shiftIstDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Whole days between two `YYYY-MM-DD` strings (`to - from`).
 *
 * Compared as calendar dates rather than instants: subtracting two parsed
 * `Date`s brings the host's offset into an answer that should only ever depend
 * on the two labels.
 */
export function daysBetweenIstDates(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const a = parse(from);
  const b = parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** `YYYY-MM-DD` → the first instant of that calendar day in IST. */
export function startOfIstDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

/** `YYYY-MM-DD` → the last instant of that calendar day in IST. */
export function endOfIstDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}
