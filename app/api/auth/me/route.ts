import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt';
import { getRecoveryEmailPolicy } from '@/lib/recoveryEmailPolicy';

export async function GET(req: NextRequest) {
  // Outside the try/catch: a missing JWT_SECRET is a server misconfiguration,
  // and must not be swallowed into the generic 401 below.
  const secret = getJwtSecret();

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, secret) as any;

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // This route verifies the token itself instead of going through withAuth,
    // so the revocation check has to be repeated here — otherwise a token
    // invalidated by a password change would still satisfy the dashboard
    // shell's own auth check and the user would appear signed in while every
    // other request failed.
    const issuedAtMs = decoded.iat ? decoded.iat * 1000 : 0;
    if (user.passwordChangedAt && issuedAtMs < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
      return NextResponse.json({ message: 'Your password was changed — please log in again' }, { status: 401 });
    }
    if (!user.isActive || user.deletedAt) {
      return NextResponse.json({ message: 'Your account is no longer active' }, { status: 401 });
    }

    const policy = getRecoveryEmailPolicy();
    const hasVerifiedRecoveryEmail = !!user.personalEmail && !!user.personalEmailVerifiedAt;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      // Drives the reminder / interstitial / hard-block progression in the
      // dashboard shell. The server enforces the same rule independently —
      // this is only so the UI can explain it before the API refuses.
      recoveryEmail: {
        address: user.personalEmail,
        verified: hasVerifiedRecoveryEmail,
        required: policy.enforced,
        daysRemaining: policy.daysRemaining,
        enforceFrom: policy.enforceFrom,
        blocked: policy.enforced && !hasVerifiedRecoveryEmail,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
