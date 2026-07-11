import { NextRequest, NextResponse } from 'next/server';

const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/access-status',
  '/api/access-requests',
  '/api/notifications',
  '/api/time-tracking',
  '/api/cron/inactive-users',
];

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const config = { matcher: ['/api/:path*'] };

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isExemptPath(pathname)) return NextResponse.next();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.next();

  try {
    const res = await fetch(new URL('/api/access-status', req.nextUrl.origin), {
      headers: {
        'authorization': authHeader,
      },
    });

    if (res.ok) {
      const gate = await res.json();
      if (gate && gate.blocked) {
        return NextResponse.json(
          { message: 'Access restricted outside allowed hours', code: 'ACCESS_RESTRICTED', ...gate },
          { status: 403 }
        );
      }
    }
  } catch (err) {
    console.error('Access check failed in proxy:', err);
  }

  return NextResponse.next();
}
