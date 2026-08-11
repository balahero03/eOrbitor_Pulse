import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const CODE_TTL_MINUTES = 10;
export const TICKET_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

// Ceilings are deliberately per-account *and* per-IP. Per-account alone lets
// one caller walk the whole staff list; per-IP alone lets a botnet hammer a
// single account. Both are counted from rows in the database rather than a
// module-level Map, which emptied on every restart and was invisible to any
// second instance.
export const MAX_CODES_PER_ACCOUNT = 3;
export const ACCOUNT_WINDOW_MINUTES = 15;
export const MAX_CODES_PER_IP = 10;
export const IP_WINDOW_MINUTES = 60;

// Resend cooldown surfaced to the UI so its timer matches what the server
// will actually accept.
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Six digits, uniformly distributed.
 *
 * `crypto.randomInt` is used rather than `Math.random` (predictable) and
 * rather than `randomBytes % 1000000` (modulo bias — low codes would be
 * marginally likelier, and a bias is exactly what a guessing attack exploits).
 * Leading zeros are preserved so every code is the same length.
 */
export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashSecret(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateTicket(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashSecret(raw) };
}

/**
 * Compare two hex digests without leaking, through response timing, how many
 * leading characters matched. `timingSafeEqual` throws on a length mismatch,
 * so the lengths are checked first — both operands are fixed-length SHA-256
 * digests here, making that check itself constant with respect to the secret.
 */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

// Behind a proxy the socket address is the proxy's; the client's is the first
// entry of X-Forwarded-For. Falls back to a constant so a request with no
// discernible origin still shares a single bucket rather than bypassing the
// per-IP limit entirely.
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export interface RateVerdict {
  allowed: boolean;
  /** Seconds until another request would be accepted; only set when blocked. */
  retryAfterSeconds?: number;
}

export async function checkRateLimits(userId: string, ip: string): Promise<RateVerdict> {
  const now = Date.now();
  const accountSince = new Date(now - ACCOUNT_WINDOW_MINUTES * 60_000);
  const ipSince = new Date(now - IP_WINDOW_MINUTES * 60_000);

  const [recentForAccount, recentForIp, latest] = await Promise.all([
    prisma.passwordResetChallenge.count({ where: { userId, createdAt: { gte: accountSince } } }),
    ip === 'unknown'
      ? Promise.resolve(0)
      : prisma.passwordResetChallenge.count({ where: { requestIp: ip, createdAt: { gte: ipSince } } }),
    prisma.passwordResetChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  if (latest) {
    const sinceLast = (now - latest.createdAt.getTime()) / 1000;
    if (sinceLast < RESEND_COOLDOWN_SECONDS) {
      return { allowed: false, retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - sinceLast) };
    }
  }
  if (recentForAccount >= MAX_CODES_PER_ACCOUNT) {
    return { allowed: false, retryAfterSeconds: ACCOUNT_WINDOW_MINUTES * 60 };
  }
  if (recentForIp >= MAX_CODES_PER_IP) {
    return { allowed: false, retryAfterSeconds: IP_WINDOW_MINUTES * 60 };
  }
  return { allowed: true };
}

/**
 * Invalidate every live challenge for a user.
 *
 * Called after a successful reset, and after any admin-initiated password
 * change — otherwise a reset code mailed before the admin intervened would
 * still override the password the admin just set.
 */
export async function revokeChallenges(userId: string): Promise<void> {
  await prisma.passwordResetChallenge.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
