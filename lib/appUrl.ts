import { NextRequest } from 'next/server';

// Base URL used to build emailed links (verification, password reset).
//
// `APP_URL` is the right answer in production — the emailed link has to point
// at the deployed host, not at whatever origin a request happened to arrive
// on. But in development it's usually still the untouched placeholder from
// .env.local.example (`http://eorbitor.internal`), which resolves nowhere and
// produces dead links. So outside production we derive the origin from the
// request, which is by definition reachable by whoever is clicking.
//
// The Host header is preferred over `nextUrl.origin`: Next binds 0.0.0.0, and
// `origin` can report that literally — a link to `http://0.0.0.0:3000` is not
// usable in a browser, whereas Host carries the name the client actually used.
/**
 * Placeholders shipped in .env.local.example. Reaching production with one of
 * these still in place produces emails whose links resolve nowhere — a failure
 * nobody notices until a locked-out user reports a dead verification link.
 */
const PLACEHOLDER_HOSTS = ['eorbitor.internal', 'localhost', '127.0.0.1', '0.0.0.0', 'example.com'];

function isPlaceholder(url: string): boolean {
  try {
    return PLACEHOLDER_HOSTS.includes(new URL(url).hostname);
  } catch {
    return true;
  }
}

let warnedAboutAppUrl = false;

export function getAppBaseUrl(req?: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    // In production the emailed link must point at the deployed host, and
    // there is no request origin worth trusting for that — a link is followed
    // from a mailbox, long after the request that generated it.
    if (!configured || isPlaceholder(configured)) {
      throw new Error(
        `APP_URL is ${configured ? `still the placeholder "${configured}"` : 'not set'}. ` +
        'Set it to the public URL of this deployment — emailed verification and ' +
        'password-reset links are built from it and would otherwise be unreachable.'
      );
    }
    return configured;
  }

  // Outside production, warn once if the placeholder is in play so the problem
  // is visible during development rather than after deploying.
  if (configured && isPlaceholder(configured) && !warnedAboutAppUrl) {
    warnedAboutAppUrl = true;
    console.warn(
      `[appUrl] APP_URL is "${configured}", which resolves nowhere. Emailed links ` +
      'use the request host in development, but this must be set to the real ' +
      'public URL before deploying.'
    );
  }

  const host = req?.headers.get('host')?.trim();
  if (host && !host.startsWith('0.0.0.0')) {
    const proto = req?.headers.get('x-forwarded-proto')?.split(',')[0].trim()
      || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  const origin = req?.nextUrl?.origin?.replace('0.0.0.0', 'localhost');
  return origin || configured || 'http://localhost:3000';
}
