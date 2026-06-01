import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
};

type Handler = (req: NextRequest, user: AuthUser) => Promise<NextResponse>;

export function withAuth(handler: Handler) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let user: AuthUser;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    } catch {
      return NextResponse.json(
        { message: 'Invalid or expired token — please log in again' },
        { status: 401 }
      );
    }

    try {
      return await handler(req, user);
    } catch (err: any) {
      const status: number = err.status || 500;
      const message: string = status < 500 ? err.message : 'Internal server error';
      if (status >= 500) console.error('[API ERROR]', err);
      return NextResponse.json({ message }, { status });
    }
  };
}

export function requireRoles(allowedRoles: string[]) {
  return function (handler: Handler): Handler {
    return async (req: NextRequest, user: AuthUser): Promise<NextResponse> => {
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json({ message: 'Access denied' }, { status: 403 });
      }
      return handler(req, user);
    };
  };
}
