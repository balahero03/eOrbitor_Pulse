import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { checkAccessGate, isExemptPath } from '@/lib/accessControl';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
};

type Handler = (req: NextRequest, user: AuthUser, context?: any) => Promise<NextResponse>;

export function withAuth(handler: Handler) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded: AuthUser;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    } catch {
      return NextResponse.json(
        { message: 'Invalid or expired token — please log in again' },
        { status: 401 }
      );
    }

    // Re-read the account from the DB on every request instead of trusting
    // the token's baked-in role. A JWT lives 30 days, so without this a
    // deactivated user (or one whose role was just switched) keeps their old
    // access until the token happens to expire.
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true, deletedAt: true },
    });
    if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
      return NextResponse.json({ message: 'Your account is no longer active — please contact your admin' }, { status: 401 });
    }

    const user: AuthUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
    };

    // After-hours access gate — this used to only be checked client-side
    // (the dashboard polling /api/access-status), so a restricted user could
    // keep calling every API directly. Enforce it here for every route that
    // isn't explicitly exempt (login, status/request endpoints, logout, etc).
    if (!isExemptPath(req.nextUrl.pathname)) {
      const gate = await checkAccessGate(user.role, user.id);
      if (gate.blocked) {
        return NextResponse.json(
          { message: 'CRM access is restricted right now. Request access from your admin.' },
          { status: 403 }
        );
      }
    }

    try {
      return await handler(req, user, context);
    } catch (err: any) {
      const status: number = err.status || 500;
      const message: string = err.message || 'Internal server error';
      if (status >= 500) console.error('[API ERROR]', err?.message, err?.code, err?.meta);
      return NextResponse.json({ message }, { status });
    }
  };
}

export function requireRoles(allowedRoles: string[]) {
  return function (handler: Handler): Handler {
    return async (req: NextRequest, user: AuthUser, context?: any): Promise<NextResponse> => {
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json({ message: 'Access denied' }, { status: 403 });
      }
      return handler(req, user, context);
    };
  };
}
