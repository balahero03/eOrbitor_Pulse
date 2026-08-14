/**
 * In-process sliding-window rate limiter.
 *
 * Scope and limits
 * ----------------
 * State lives in this process's memory, which is the right trade for this
 * deployment — docker-compose runs a single app container — but it means the
 * counters reset when the process restarts and are not shared if the app is
 * ever scaled to more than one instance. The password-reset flow keeps its
 * limits in Postgres for exactly that durability; this is deliberately lighter,
 * because it guards an endpoint that is hit on every sign-in and should not add
 * a database round trip to each one.
 *
 * If the app is ever run multi-instance, move these counters to Postgres or
 * Redis — otherwise the effective limit multiplies by the instance count.
 */

interface Hit {
  /** Timestamps of attempts still inside the window. */
  times: number[];
  /** Set when a lockout is in force; epoch ms. */
  blockedUntil?: number;
}

const buckets = new Map<string, Hit>();

/** Stop the map growing without bound on a long-running server. */
let lastSweep = Date.now();
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hit] of buckets) {
    const fresh = hit.times.filter((t) => now - t < windowMs);
    if (fresh.length === 0 && (!hit.blockedUntil || hit.blockedUntil < now)) buckets.delete(key);
    else hit.times = fresh;
  }
}

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfterSeconds?: number;
  /** Attempts left before a lockout; useful for a warning in the response. */
  remaining?: number;
}

/**
 * Record an attempt and say whether it is allowed.
 *
 * `key` should identify the actor as narrowly as is safe — for a login that is
 * the submitted email *and* the client IP, so one attacker cannot lock out an
 * unrelated user by hammering their address from elsewhere.
 */
export function rateLimit(
  key: string,
  { max, windowMs, blockMs }: { max: number; windowMs: number; blockMs: number }
): RateLimitVerdict {
  const now = Date.now();
  sweep(now, windowMs);

  const hit = buckets.get(key) ?? { times: [] };
  buckets.set(key, hit);

  if (hit.blockedUntil && hit.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((hit.blockedUntil - now) / 1000) };
  }

  hit.times = hit.times.filter((t) => now - t < windowMs);
  hit.times.push(now);

  if (hit.times.length > max) {
    hit.blockedUntil = now + blockMs;
    hit.times = [];
    return { allowed: false, retryAfterSeconds: Math.ceil(blockMs / 1000) };
  }

  return { allowed: true, remaining: Math.max(0, max - hit.times.length) };
}

/** Forget an actor's attempts — called after a successful sign-in. */
export function clearRateLimit(key: string) {
  buckets.delete(key);
}

/** Best-effort client address from the usual proxy headers. */
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('x-real-ip')?.trim() || 'unknown';
}
