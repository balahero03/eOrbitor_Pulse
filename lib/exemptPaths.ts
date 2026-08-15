/**
 * API paths the after-hours access gate must never block.
 *
 * A user who is currently locked out still has to be able to check *why*
 * (`/api/access-status`), ask for an exception (`/api/access-requests`), read
 * the answer (`/api/notifications`), and log out (`/api/time-tracking`). Gating
 * those would leave a blocked user with no way back in and no explanation.
 *
 * This list is enforced in two places — `lib/accessControl.ts`, which is the
 * real check inside `withAuth`, and `proxy.ts`, which is a cheap early
 * rejection in front of it. It lived in both as its own copy, which is exactly
 * the shape of thing that stays correct right up until someone edits one of
 * them.
 *
 * It is its own module rather than being imported from `lib/accessControl.ts`
 * because `proxy.ts` runs in the Edge runtime, and accessControl pulls in
 * Prisma, which cannot. Nothing here imports anything.
 */
export const ACCESS_GATE_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/access-status',
  '/api/access-requests',
  '/api/notifications',
  '/api/time-tracking',
  // Scheduled jobs authenticate with CRON_SECRET, not a user session, so an
  // hours policy that applies to people should never apply to them. Neither
  // route currently reaches the gate — they do not use `withAuth`, and the
  // proxy only inspects requests carrying a Bearer token — but leaving them
  // off the list would make that a coincidence rather than a decision.
  '/api/cron/inactive-users',
  '/api/cron/payment-reminders',
];

export function isExemptPath(pathname: string): boolean {
  return ACCESS_GATE_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
