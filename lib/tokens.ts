import crypto from 'crypto';

// Shared helper for every "emailed one-time link" flow (password reset,
// email verification): generate a random token, hand the raw value to the
// caller for the email link, and only ever persist its hash. A DB read (or
// leak) alone can then never be replayed to reset a password or confirm an
// email — the raw token only ever exists in transit, in the recipient's inbox.
export function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
