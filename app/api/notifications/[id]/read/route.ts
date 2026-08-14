import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError } from '@/lib/errors';

/**
 * Mark one of *your own* notifications read.
 *
 * This route previously verified the token by hand and then ran
 * `notification.update({ where: { id } })` with no owner check, so any signed-in
 * user could mark any other user's notification read just by knowing its id.
 * Every sibling route (`/api/notifications`, `.../read-all`) already scopes by
 * `userId`; this one had drifted.
 *
 * `updateMany` with both keys does the ownership check inside the write, so
 * there is no read-then-write gap: a row that is not yours simply matches
 * nothing and reports as not found — the same answer as an id that does not
 * exist, which also avoids confirming that someone else's notification is real.
 */
export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/read')[0].split('/').pop()!;

  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true, readAt: new Date() },
  });

  // Previously every failure — including an invalid token — came back as a 500
  // "Failed to mark notification as read", which made a permissions problem
  // look like a server fault.
  if (result.count === 0) throw new NotFoundError('Notification');

  const notification = await prisma.notification.findUnique({ where: { id } });
  return NextResponse.json(notification);
});
