import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, requireRoles, AuthUser } from '@/lib/middleware/auth';
import { ValidationError } from '@/lib/errors';
import { currentNightDate } from '@/lib/accessControl';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM', 'ON_FIELD_TEAM'];
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function getOrCreatePolicy() {
  return prisma.accessPolicy.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

// Whether the configured window is inside its restricted period right now —
// independent of any specific user's role/approvals. Lets the admin panel
// show "this would currently restrict access" without needing a second,
// lower-privileged account to test against.
function withCurrentlyRestricting<T extends { enabled: boolean; windowStart: string; windowEnd: string }>(policy: T) {
  const currentlyRestricting = policy.enabled && currentNightDate(policy.windowStart, policy.windowEnd) !== null;
  return { ...policy, currentlyRestricting };
}

export const GET = withAuth(
  requireRoles(ADMIN_ROLES)(async (_req: NextRequest, _user: AuthUser) => {
    const policy = await getOrCreatePolicy();
    return NextResponse.json(withCurrentlyRestricting(policy));
  })
);

export const PATCH = withAuth(
  requireRoles(ADMIN_ROLES)(async (req: NextRequest, user: AuthUser) => {
    const body = await req.json();
    const { enabled, restrictedRoles, windowStart, windowEnd, forceCutoff } = body;

    if (restrictedRoles !== undefined) {
      if (!Array.isArray(restrictedRoles) || !restrictedRoles.every((r) => ALL_ROLES.includes(r))) {
        throw new ValidationError('restrictedRoles must be an array of valid roles');
      }
      if (restrictedRoles.some((r: string) => ADMIN_ROLES.includes(r))) {
        throw new ValidationError('SUPER_ADMIN and ADMIN can never be restricted');
      }
    }
    if (windowStart !== undefined && !HHMM.test(windowStart)) {
      throw new ValidationError('windowStart must be HH:mm');
    }
    if (windowEnd !== undefined && !HHMM.test(windowEnd)) {
      throw new ValidationError('windowEnd must be HH:mm');
    }
    if (windowStart !== undefined || windowEnd !== undefined) {
      const existing = await getOrCreatePolicy();
      const start = windowStart ?? existing.windowStart;
      const end = windowEnd ?? existing.windowEnd;
      if (start === end) {
        throw new ValidationError('windowStart and windowEnd cannot be equal');
      }
    }

    const policy = await prisma.accessPolicy.upsert({
      where: { id: 'singleton' },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(restrictedRoles !== undefined && { restrictedRoles }),
        ...(windowStart !== undefined && { windowStart }),
        ...(windowEnd !== undefined && { windowEnd }),
        ...(forceCutoff !== undefined && { forceCutoff }),
        updatedBy: user.id,
      },
      create: {
        id: 'singleton',
        enabled: enabled ?? false,
        restrictedRoles: restrictedRoles ?? [],
        windowStart: windowStart ?? '21:00',
        windowEnd: windowEnd ?? '08:00',
        forceCutoff: forceCutoff ?? false,
        updatedBy: user.id,
      },
    });

    return NextResponse.json(withCurrentlyRestricting(policy));
  })
);
