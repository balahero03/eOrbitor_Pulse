import { prisma } from '@/lib/prisma';

// A subset of Prisma's NotificationType — the values the app actually sends.
// Widen it as new notifications are added rather than casting at call sites,
// so the compiler keeps catching typos in enum names.
type NotifType =
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'TASK_ASSIGNED'
  | 'USER_INACTIVE'
  | 'QUOTATION_APPROVED'
  | 'LEAD_ASSIGNED';

export async function createNotification(
  userId: string,
  type: NotifType,
  title: string,
  message: string,
  relatedEntityType?: string,
  relatedEntityId?: string,
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        message,
        relatedEntityType: relatedEntityType ?? null,
        relatedEntityId: relatedEntityId ?? null,
        isRead: false,
      },
    });
  } catch (err) {
    console.error('[notify] Failed to create notification:', err);
  }
}

export async function notifyAdminsAndManagers(
  type: NotifType,
  title: string,
  message: string,
  relatedEntityType?: string,
  relatedEntityId?: string,
  excludeUserId?: string,
) {
  const targets = await prisma.user.findMany({
    where: {
      role: { in: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'] },
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  await Promise.all(
    targets.map((u) =>
      createNotification(u.id, type, title, message, relatedEntityType, relatedEntityId),
    ),
  );
}
