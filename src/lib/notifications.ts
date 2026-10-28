import { prisma } from '@/lib/db/prisma'
import type { NotificationType } from '@prisma/client'

export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  relatedEntityId?: string,
  title?: string,
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title: title ?? type.replace(/_/g, ' '),
      message,
      relatedEntityId,
    },
  })
}
