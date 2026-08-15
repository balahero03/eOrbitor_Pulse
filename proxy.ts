import { NextRequest, NextResponse } from 'next/server';
import { isExemptPath } from '@/lib/exemptPaths';

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
