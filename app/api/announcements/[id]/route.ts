import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const id = req.nextUrl.pathname.split('/').pop();
  if (!id) {
    return NextResponse.json({ error: 'Announcement ID required' }, { status: 400 });
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!announcement) {
    return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
  }

  return NextResponse.json(announcement);
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError('Only admins can update announcements');
  }

  const id = req.nextUrl.pathname.split('/').pop();
  if (!id) {
    return NextResponse.json({ error: 'Announcement ID required' }, { status: 400 });
  }

  const body = await req.json();
  const { title, content, priority, isPublished, expiresAt } = body;

  const updateData: any = {};

  // Only add fields that are explicitly provided
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (priority !== undefined) updateData.priority = priority;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

  // Handle isPublished with publishedAt timestamp
  if (typeof isPublished === 'boolean') {
    updateData.isPublished = isPublished;
    updateData.publishedAt = isPublished ? new Date() : null;
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data: updateData,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(announcement);
});

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError('Only admins can delete announcements');
  }

  const id = req.nextUrl.pathname.split('/').pop();
  if (!id) {
    return NextResponse.json({ error: 'Announcement ID required' }, { status: 400 });
  }

  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ message: 'Announcement deleted' });
});
