import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt';
import { checkAccessGate, isExemptPath } from '@/lib/accessControl';
import { getRecoveryEmailPolicy, isAllowedWhileRecoveryIncomplete } from '@/lib/recoveryEmailPolicy';

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
    // Resolved outside the try/catch below so that a missing JWT_SECRET fails
    // as a server error instead of being reported to every user as an expired
    // token — a misconfigured deploy should be obvious, not look like mass logout.
    const secret = getJwtSecret();
    let decoded: AuthUser;
    try {
      decoded = jwt.verify(token, secret) as AuthUser;
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
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true,
        isActive: true, deletedAt: true, passwordChangedAt: true,
        personalEmail: true, personalEmailVerifiedAt: true,
      },
    });
    if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
      return NextResponse.json({ message: 'Your account is no longer active — please contact your admin' }, { status: 401 });
    }

    // Revocation for a stateless token. Tokens live 30 days, so without this a
    // password reset left any stolen session fully alive — at exactly the
    // moment the owner believed they had taken the account back. `iat` is
    // stamped by jsonwebtoken at signing time and is in seconds; anything
    // issued before the last password change is no longer trusted.
    // `Math.floor` on the boundary keeps a token minted in the same second as
    // the change from being rejected by sub-second rounding alone.
    const issuedAtMs = (decoded as any).iat ? (decoded as any).iat * 1000 : 0;
    if (dbUser.passwordChangedAt && issuedAtMs < Math.floor(dbUser.passwordChangedAt.getTime() / 1000) * 1000) {
      return NextResponse.json(
        { message: 'Your password was changed — please log in again' },
        { status: 401 }
      );
    }

    const user: AuthUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
    };

    // Recovery-email requirement. Enforced server-side for the same reason
    // the after-hours gate below is: a client-only check is bypassed by
    // calling the API directly. Gated behind a configured date so existing
    // users are never locked out of a system they were already using.
    const recoveryPolicy = getRecoveryEmailPolicy();
    if (recoveryPolicy.enforced && !isAllowedWhileRecoveryIncomplete(req.nextUrl.pathname)) {
      if (!dbUser.personalEmail || !dbUser.personalEmailVerifiedAt) {
        return NextResponse.json(
          {
            message: 'Add and verify a recovery email in your profile to continue.',
            code: 'RECOVERY_EMAIL_REQUIRED',
          },
          { status: 403 }
        );
      }
    }

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
      if (status < 500) {
        // A typed error from lib/errors.ts. Its message was written to be read
        // by the person who triggered it, so it passes through unchanged.
        return NextResponse.json({ message: err.message || 'Request failed' }, { status });
      }

      // Anything else is a fault, and its message was written for us, not for
      // the caller. Returning it verbatim leaked a great deal: a request for
      // /api/orders?page=0 handed the client Prisma's full failure — the model
      // and method being called, the offending argument, an excerpt of the
      // compiled source, and the absolute filesystem path of the project on the
      // server. Confirmed reproducible as an ON_FIELD_TEAM user, the
      // lowest-privilege role in the system, with nothing but a URL edit.
      //
      // Details still go to the server log, where the operator of a self-hosted
      // deployment can read them; and outside production they are returned as
      // well, so local debugging is unaffected.
      console.error('[API ERROR]', req.method, req.nextUrl.pathname, err?.message, err?.code, err?.meta);
      return NextResponse.json(
        {
          message: 'Something went wrong on our end. Please try again, or contact your administrator if it persists.',
          ...(process.env.NODE_ENV !== 'production' ? { detail: err?.message } : {}),
        },
        { status: 500 }
      );
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
