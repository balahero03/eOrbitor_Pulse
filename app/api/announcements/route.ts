import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  // Admins see all (drafts + published), others see only published
  const where = isAdmin ? {} : { isPublished: true };

  const skip = (page - 1) * limit;
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.announcement.count({ where }),
  ]);

  return NextResponse.json({
    data: announcements,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError('Only admins can create announcements');
  }

  const { title, content, priority = 'NORMAL', expiresAt } = await req.json();

  if (!title || !content) {
    return NextResponse.json({ message: 'Title and content are required' }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title, content, priority,
      createdById: user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json(announcement, { status: 201 });
});
