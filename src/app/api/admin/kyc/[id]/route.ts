import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO', 'CANCEL_APPROVAL']),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('COMPLIANCE', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { action, reason } = parsed.data

  const before = await prisma.keyPerson.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const statusMap = {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    REQUEST_INFO: 'PENDING_INFO',
    CANCEL_APPROVAL: 'SUBMITTED',
  } as const

  const keyPerson = await prisma.keyPerson.update({
    where: { id },
    data: {
      kycStatus: statusMap[action],
      kycApprovedById: action === 'APPROVE' ? session!.user.id : undefined,
      kycApprovedAt: action === 'APPROVE' ? new Date() : undefined,
      kycRejectionReason: action === 'REJECT' ? reason : undefined,
      ...(action === 'CANCEL_APPROVAL' && {
        kycApprovedById: null,
        kycApprovedAt: null,
        kycExpiryDate: null,
        kycRejectionReason: null,
      }),
    },
  })

  await logAudit(session!.user.id, `KYC_${action}`, 'KeyPerson', id, before, keyPerson)

  // Notify the portal submitter and any linked client account.
  const link = await prisma.companyKeyPerson.findFirst({
    where: { keyPersonId: id },
    include: { company: { select: { clientUserId: true } } },
  })
  const notifyUserIds = new Set<string>()
  if (before.submittedByUserId) notifyUserIds.add(before.submittedByUserId)
  if (link?.company.clientUserId) notifyUserIds.add(link.company.clientUserId)
  const msgMap = {
    APPROVE: 'Your KYC has been approved.',
    REJECT: `Your KYC was rejected: ${reason ?? ''}`,
    REQUEST_INFO: 'Additional information is required for your KYC.',
    CANCEL_APPROVAL: 'Your KYC approval has been cancelled. Please wait for review or submit a new KYC if needed.',
  }
  for (const userId of notifyUserIds) {
    await createNotification(userId, 'KYC_STATUS_CHANGE', msgMap[action], id)
  }

  return NextResponse.json(keyPerson)
}
