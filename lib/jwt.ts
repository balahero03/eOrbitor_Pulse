import jwt, { SignOptions } from 'jsonwebtoken';

// The literal that used to be hardcoded as `process.env.JWT_SECRET || 'dev-secret'`
// across the auth routes. It is published in this repo (and in CLAUDE.md), so any
// deployment that fell back to it was accepting tokens a stranger could mint —
// including one claiming `role: 'SUPER_ADMIN'`. It survives for local dev only.
const DEV_FALLBACK_SECRET = 'dev-secret';

export const TOKEN_TTL = '30d';

/**
 * Resolve the JWT signing/verification secret.
 *
 * In production a real `JWT_SECRET` is mandatory and its absence throws, so a
 * misconfigured deploy fails loudly (500s on every authed request) instead of
 * silently granting forgeable full access. Outside production we keep the old
 * fallback so `npm run dev` still works with no env file, but warn once.
 *
 * This is deliberately a function, not a module-level constant: `next build`
 * imports route modules without running them, and a top-level throw would turn
 * a missing build-time env var into a failed image build.
 */
let warnedAboutFallback = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (secret) {
    // An explicitly-configured 'dev-secret' in production is the same hole as
    // no secret at all, so treat it identically rather than trusting the value.
    if (isProduction && secret === DEV_FALLBACK_SECRET) {
      throw new Error(
        'JWT_SECRET is set to the well-known development value. Set a unique secret before running in production.'
      );
    }
    return secret;
  }

  if (isProduction) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to sign or verify tokens with the public development fallback.'
    );
  }

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn('[auth] JWT_SECRET is unset — using the development fallback secret. Never do this in production.');
  }
  return DEV_FALLBACK_SECRET;
}

export function signToken(payload: object, options: SignOptions = { expiresIn: TOKEN_TTL }): string {
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyToken<T = any>(token: string): T {
  return jwt.verify(token, getJwtSecret()) as T;
}
