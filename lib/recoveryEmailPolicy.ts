// When a verified recovery email stops being a suggestion and becomes a
// requirement.
//
// Driven by a single date in the environment rather than a per-user column,
// because the hard problem is not tracking who complied — it is not locking
// out people who were using the system perfectly happily before the rule
// existed. A date can be read at a glance, moved if the rollout needs more
// time, and reasoned about without querying anything.
//
//   RECOVERY_EMAIL_ENFORCE_FROM="2026-08-25"   enforced from this date
//   (unset)                                     never enforced — reminder only
export interface RecoveryEmailPolicy {
  /** True once a verified recovery email is required to use the app. */
  enforced: boolean;
  /** ISO date the requirement begins, or null when no date is configured. */
  enforceFrom: string | null;
  /** Whole days remaining; null when unset, 0 once the date has passed. */
  daysRemaining: number | null;
}

export function getRecoveryEmailPolicy(now: Date = new Date()): RecoveryEmailPolicy {
  const raw = process.env.RECOVERY_EMAIL_ENFORCE_FROM?.trim();
  if (!raw) return { enforced: false, enforceFrom: null, daysRemaining: null };

  // Parsed as midnight UTC. A malformed value must not silently become "now"
  // (which would lock everyone out on the next deploy), so an unparseable
  // date falls back to not enforcing.
  const target = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) {
    console.warn(`[recovery-email] RECOVERY_EMAIL_ENFORCE_FROM="${raw}" is not a valid YYYY-MM-DD date — enforcement disabled.`);
    return { enforced: false, enforceFrom: null, daysRemaining: null };
  }

  const msLeft = target.getTime() - now.getTime();
  return {
    enforced: msLeft <= 0,
    enforceFrom: raw,
    daysRemaining: Math.max(0, Math.ceil(msLeft / 86_400_000)),
  };
}

// Paths a user still blocked by this rule must be able to reach: reading their
// own profile, setting and verifying the address, and signing out. Everything
// else is refused until they comply — otherwise the requirement is decoration.
const ALLOWED_WHILE_INCOMPLETE = [
  '/api/auth/me',
  '/api/auth/login',
  '/api/profile',
  '/api/time-tracking',
  '/api/access-status',
];

export function isAllowedWhileRecoveryIncomplete(pathname: string): boolean {
  return ALLOWED_WHILE_INCOMPLETE.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
