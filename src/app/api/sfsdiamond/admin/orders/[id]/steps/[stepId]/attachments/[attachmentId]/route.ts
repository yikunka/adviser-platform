import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { createNotification } from '@/lib/notifications'
import { sendSfsProductionImageEmail } from '@/lib/email/resend'

const updateSchema = z.object({
  reviewStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string; attachmentId: string }> },
) {
  const { session, error } = await requirePermission('sfsOrders.approve')
  if (error) return error

  const { id, stepId, attachmentId } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const attachment = await prisma.sfsOrderStepAttachment.findFirst({
    where: { id: attachmentId, stepId, step: { orderId: id } },
    include: {
      step: {
        select: {
          particular: true,
          order: {
            select: {
              id: true,
              memorialName: true,
              sampleCode: true,
              userId: true,
              user: { select: { email: true, nameEn: true } },
            },
          },
        },
      },
    },
  })

  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const nextStatus = parsed.data.reviewStatus
  const updated = await prisma.sfsOrderStepAttachment.update({
    where: { id: attachment.id },
    data: {
      reviewStatus: nextStatus,
      reviewedById: nextStatus === 'PENDING' ? null : session.user.id,
      reviewedAt: nextStatus === 'PENDING' ? null : new Date(),
    },
  })

  const partnerUserId = attachment.step.order.userId
  if (nextStatus === 'APPROVED' && attachment.reviewStatus !== 'APPROVED' && partnerUserId) {
    const order = attachment.step.order
    const orderLabel = order.sampleCode ?? order.memorialName
    await Promise.allSettled([
      createNotification(
        partnerUserId,
        'GENERAL',
        `New SFS Diamond production image is ready to view for ${orderLabel}.`,
        order.id,
        'Production image ready',
      ),
      order.user?.email
        ? sendSfsProductionImageEmail(order.user.email, {
            partnerName: order.user.nameEn,
            orderId: order.id,
            sampleCode: order.sampleCode,
            memorialName: order.memorialName,
          })
        : Promise.resolve(),
    ])
  }

  return NextResponse.json({ attachment: updated })
}
