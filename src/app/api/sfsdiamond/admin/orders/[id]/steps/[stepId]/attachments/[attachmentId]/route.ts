import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { createNotification } from '@/lib/notifications'

const updateSchema = z.object({
  reviewStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string; attachmentId: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
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
          order: { select: { id: true, memorialName: true, sampleCode: true, userId: true } },
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

  if (nextStatus === 'APPROVED' && attachment.reviewStatus !== 'APPROVED' && attachment.step.order.userId) {
    const orderLabel = attachment.step.order.sampleCode ?? attachment.step.order.memorialName
    await createNotification(
      attachment.step.order.userId,
      'GENERAL',
      `New SFS Diamond production image is ready to view for ${orderLabel}.`,
      attachment.step.order.id,
    )
  }

  return NextResponse.json({ attachment: updated })
}
