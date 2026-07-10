import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { checkAccessGate, isExemptPath } from '@/lib/accessControl';

// The real enforcement point for after-hours access restriction. Roughly
// half of this app's API routes never go through lib/middleware/auth.ts's
// withAuth() (many `[id]` routes do their own inline jwt.verify), so a check
// added only there would be trivially bypassable. This runs in front of
// every /api/* request regardless of which auth pattern the route uses, and
// is purely additive — it only ever adds a 403 on top of what the route
// would otherwise do, never grants access.
export const config = { matcher: ['/api/:path*'] };

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isExemptPath(pathname)) return NextResponse.next();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.next(); // let the route's own auth reject it

  let user: { id: string; role: string };
  try {
    user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'dev-secret') as any;
  } catch {
    return NextResponse.next(); // invalid/expired token — let the route return its own 401
  }

  const gate = await checkAccessGate(user.role, user.id);
  if (gate.blocked) {
    return NextResponse.json(
      { message: 'Access restricted outside allowed hours', code: 'ACCESS_RESTRICTED', ...gate },
      { status: 403 }
    );
  }
  return NextResponse.next();
}
