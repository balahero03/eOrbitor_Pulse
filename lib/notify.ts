import { prisma } from '@/lib/prisma';

type NotifType =
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'TASK_ASSIGNED'
  | 'USER_INACTIVE';

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
      role: { in: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'] },
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
