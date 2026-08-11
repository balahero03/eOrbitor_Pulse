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
export function getAppBaseUrl(req?: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    return configured || 'http://localhost:3000';
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
