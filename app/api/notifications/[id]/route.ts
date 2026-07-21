import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!notification) {
    return NextResponse.json({ message: 'Notification not found' }, { status: 404 });
  }

  if (notification.userId !== user.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  await prisma.notification.delete({ where: { id } });

  return NextResponse.json({ message: 'Notification deleted' });
});
