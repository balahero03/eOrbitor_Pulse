import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';

const DEV_FALLBACK_SECRET = 'cron-secret';
const INACTIVE_HOURS = 48;

/**
 * The only thing standing in front of this endpoint, which is otherwise
 * unauthenticated so an external scheduler can call it.
 *
 * It used to fall back to the literal 'cron-secret' whenever CRON_SECRET was
 * unset — a value published in this repository — so on any deployment that had
 * not configured it, anyone could fire the job and its notification fan-out.
 * Resolved per request, and refused outright in production, matching how
 * lib/jwt.ts treats its own development fallback.
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

export async function POST(req: NextRequest) {
  let expected: string;
  try {
    expected = getCronSecret();
  } catch (err: any) {
    console.error('[cron/inactive-users]', err.message);
    return NextResponse.json({ error: 'Cron endpoint is not configured' }, { status: 503 });
  }

  const secret = req.headers.get('x-cron-secret');
  if (!secret || !secretsMatch(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - INACTIVE_HOURS * 60 * 60 * 1000);

  // Find active users (ON_FIELD_TEAM, BACKEND_TEAM) who haven't logged in for 48h
  const inactiveUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['ON_FIELD_TEAM', 'BACKEND_TEAM'] },
      OR: [
        { timeLogs: { none: { loginTime: { gte: cutoff } } } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      managerId: true,
    },
  });

  if (inactiveUsers.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  // Get all super admins + managers who need to be notified
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true },
  });

  let notified = 0;

  for (const inactiveUser of inactiveUsers) {
    const name = `${inactiveUser.firstName} ${inactiveUser.lastName}`;
    const title = 'User Inactive Alert';
    const message = `${name} (${inactiveUser.email}) has not logged in for over 48 hours.`;

    const notifyIds = new Set<string>(superAdmins.map((u) => u.id));

    // Also notify their direct manager
    if (inactiveUser.managerId) {
      notifyIds.add(inactiveUser.managerId);
    }

    // If user is a manager themselves, notify super admins only (already added)

    for (const targetId of notifyIds) {
      await createNotification(targetId, 'USER_INACTIVE', title, message, 'USER', inactiveUser.id);
    }

    notified++;
  }

  return NextResponse.json({ notified, inactiveUsers: inactiveUsers.map((u) => u.email) });
}
