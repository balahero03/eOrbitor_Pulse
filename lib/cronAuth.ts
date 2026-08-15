import { NextRequest, NextResponse } from 'next/server';

const DEV_FALLBACK_SECRET = 'cron-secret';

/**
 * Shared gate for the cron endpoints.
 *
 * These routes sit outside `withAuth` — an external scheduler has no JWT — so
 * a shared secret is the only thing in front of them. Extracted here when the
 * second such endpoint arrived, rather than copied: the interesting part is
 * the refusal to fall back to a published value in production, and that is
 * exactly the kind of check that rots when it exists in two places and only
 * one of them gets updated.
 */
function getCronSecret(): string {
  const secret = process.env.CRON_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (secret) {
    if (isProduction && secret === DEV_FALLBACK_SECRET) {
      throw new Error(
        'CRON_SECRET is set to the well-known development value. Set a unique secret before running in production.'
      );
    }
    return secret;
  }
  if (isProduction) {
    throw new Error('CRON_SECRET is not set. Refusing to expose the cron endpoint with a public fallback.');
  }
  return DEV_FALLBACK_SECRET;
}

/** Constant-time compare so a wrong secret cannot be recovered by timing. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Returns a response to send back when the caller is not an authorised
 * scheduler, or `null` when the request may proceed.
 */
export function checkCronAuth(req: NextRequest, label: string): NextResponse | null {
  let expected: string;
  try {
    expected = getCronSecret();
  } catch (err: any) {
    console.error(`[cron/${label}]`, err.message);
    return NextResponse.json({ error: 'Cron endpoint is not configured' }, { status: 503 });
  }

  const secret = req.headers.get('x-cron-secret');
  if (!secret || !secretsMatch(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
