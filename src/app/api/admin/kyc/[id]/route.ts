import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { createNotification } from '@/lib/notifications'
import { nextKycCode } from '@/lib/kyc/kyc-code'
import { kycPersonDraftZod, inputToKeyPersonAdminUpdate } from '@/lib/kyc/personZod'
import { getRelatedCompaniesForKeyPerson } from '@/lib/kyc/relatedCompanies'
import { assertPersonDdrForApproval } from '@/lib/docgen/ddr-quarter'
import { z } from 'zod'

const statusSchema = z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'INACTIVE'])
const adminUpdateSchema = kycPersonDraftZod.extend({
  kycStatus: statusSchema.optional(),
  clientUserId: z.string().optional().nullable(),
})

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'CANCEL_APPROVAL', 'SET_INACTIVE']),
  reason: z.string().max(500).optional(),
})

const REVIEW_ACTIONS = new Set(['APPROVE', 'REJECT', 'CANCEL_APPROVAL', 'SET_INACTIVE'])

const adminNotesSchema = z.object({
  adminNotes: z.string().max(5000),
})

const kycRecordInclude = {
  kycDocuments: {
    orderBy: { uploadedAt: 'desc' as const },
    select: {
      id: true,
      fileName: true,
      documentType: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
      status: true,
      uploadedAt: true,
    },
  },
  submittedByUser: { select: { id: true, email: true, nameEn: true } },
  companyLinks: {
    include: {
      company: {
        select: {
          nameEn: true,
          clientUser: { select: { id: true, email: true, nameEn: true } },
        },
      },
    },
  },
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const record = await prisma.keyPerson.findUnique({
    where: { id },
    include: kycRecordInclude,
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const relatedCompanies = await getRelatedCompaniesForKeyPerson({
    id: record.id,
    submittedByUserId: record.submittedByUserId,
    submittedByEmail: record.submittedByUser?.email ?? null,
  })

  return NextResponse.json({ ...record, relatedCompanies })
}

function isReviewBody(body: unknown): body is z.infer<typeof reviewSchema> {
  if (!body || typeof body !== 'object') return false
  const action = (body as { action?: unknown }).action
  return typeof action === 'string' && REVIEW_ACTIONS.has(action)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('COMPLIANCE', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)

  const before = await prisma.keyPerson.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lightweight notes-only update (does not require full KYC form payload)
  if (
    body &&
    typeof body === 'object' &&
    'adminNotes' in body &&
    Object.keys(body as object).every(k => k === 'adminNotes')
  ) {
    const notesParsed = adminNotesSchema.safeParse(body)
    if (!notesParsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    const keyPerson = await prisma.keyPerson.update({
      where: { id },
      data: { adminNotes: notesParsed.data.adminNotes.trim() || null },
      include: kycRecordInclude,
    })
    await logAudit(session!.user.id, 'KYC_ADMIN_NOTES', 'KeyPerson', id, before, keyPerson)
    const relatedCompanies = await getRelatedCompaniesForKeyPerson({
      id: keyPerson.id,
      submittedByUserId: keyPerson.submittedByUserId,
      submittedByEmail: keyPerson.submittedByUser?.email ?? null,
    })
    return NextResponse.json({ ...keyPerson, relatedCompanies })
  }

  if (isReviewBody(body)) {
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

    const { action, reason } = parsed.data

    if (action === 'APPROVE') {
      try {
        await assertPersonDdrForApproval(id)
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'PERSON_DDR required before approve' },
          { status: 400 },
        )
      }
    }

    const statusMap = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      CANCEL_APPROVAL: 'DRAFT',
      SET_INACTIVE: 'INACTIVE',
    } as const

    const keyPerson = await prisma.keyPerson.update({
      where: { id },
      data: {
        kycStatus: statusMap[action],
        kycCode: action === 'APPROVE' && !before.kycCode ? await nextKycCode() : undefined,
        kycApprovedById: action === 'APPROVE' ? session!.user.id : undefined,
        kycApprovedAt: action === 'APPROVE' ? new Date() : undefined,
        kycRejectionReason: action === 'REJECT' ? reason : undefined,
        ...((action === 'CANCEL_APPROVAL' || action === 'SET_INACTIVE') && {
          kycApprovedById: null,
          kycApprovedAt: null,
          kycExpiryDate: null,
          ...(action === 'CANCEL_APPROVAL' ? { kycRejectionReason: null } : {}),
        }),
      },
    })

    await logAudit(session!.user.id, `KYC_${action}`, 'KeyPerson', id, before, keyPerson)

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
      CANCEL_APPROVAL: 'Your KYC approval has been cancelled. Please wait for review or submit a new KYC if needed.',
      SET_INACTIVE: 'Your KYC record has been marked inactive.',
    }
    for (const userId of notifyUserIds) {
      await createNotification(userId, 'KYC_STATUS_CHANGE', msgMap[action], id)
    }

    return NextResponse.json(keyPerson)
  }

  const parsed = adminUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const updateData = inputToKeyPersonAdminUpdate(parsed.data) as Record<string, unknown>
  const clientUserId = parsed.data.clientUserId?.trim() || null
  if (parsed.data.clientUserId !== undefined) {
    if (clientUserId) {
      const client = await prisma.user.findFirst({
        where: { id: clientUserId, role: 'CLIENT' },
        select: { id: true },
      })
      if (!client) return NextResponse.json({ error: 'Invalid client account' }, { status: 400 })
    }
    updateData.submittedByUserId = clientUserId
  }
  if (parsed.data.kycStatus) {
    updateData.kycStatus = parsed.data.kycStatus
    if ((parsed.data.kycStatus === 'DRAFT' || parsed.data.kycStatus === 'APPROVED') && !before.kycCode && !updateData.kycCode) {
      updateData.kycCode = await nextKycCode()
    }
    if (parsed.data.kycStatus === 'APPROVED') {
      if (before.kycStatus !== 'APPROVED') {
        try {
          await assertPersonDdrForApproval(id)
        } catch (err) {
          return NextResponse.json(
            { error: err instanceof Error ? err.message : 'PERSON_DDR required before approve' },
            { status: 400 },
          )
        }
      }
      updateData.kycApprovedById = before.kycApprovedById ?? session!.user.id
      updateData.kycApprovedAt = before.kycApprovedAt ?? new Date()
      updateData.kycRejectionReason = null
    } else {
      updateData.kycApprovedById = null
      updateData.kycApprovedAt = null
      updateData.kycExpiryDate = null
      if (parsed.data.kycStatus !== 'REJECTED') updateData.kycRejectionReason = null
    }
  }

  const keyPerson = await prisma.keyPerson.update({
    where: { id },
    data: updateData as never,
    include: kycRecordInclude,
  })

  await logAudit(session!.user.id, 'KYC_ADMIN_UPDATE', 'KeyPerson', id, before, keyPerson)

  const relatedCompanies = await getRelatedCompaniesForKeyPerson({
    id: keyPerson.id,
    submittedByUserId: keyPerson.submittedByUserId,
    submittedByEmail: keyPerson.submittedByUser?.email ?? null,
  })

  return NextResponse.json({ ...keyPerson, relatedCompanies })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('COMPLIANCE', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const before = await prisma.keyPerson.findUnique({
    where: { id },
    include: {
      kycDocuments: true,
      companyLinks: true,
      amlChecks: true,
    },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.keyPerson.delete({ where: { id } })
  await logAudit(session!.user.id, 'KYC_ADMIN_DELETE', 'KeyPerson', id, before, null)

  return NextResponse.json({ ok: true })
}
