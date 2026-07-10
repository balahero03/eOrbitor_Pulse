import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';

const CRON_SECRET = process.env.CRON_SECRET || 'cron-secret';
const INACTIVE_HOURS = 48;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== CRON_SECRET) {
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
