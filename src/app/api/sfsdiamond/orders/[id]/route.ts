import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import {
  designUploadRefsFromInput,
  diamondsJsonForPersistence,
  sfsOrderInputSchema,
  validateSfsOrderSpecOptions,
} from '@/lib/sfs/order-input'
import { deleteSfsDesignFile } from '@/lib/storage/r2'
import { claimPendingDesignUploads, hashSfsDesignDraftToken, SFS_DESIGN_DRAFT_COOKIE } from '@/lib/sfs/pending-design-uploads'
import { getSfsAccountAccess, sfsApprovalForbiddenResponse } from '@/lib/sfs/account-approval'
import { captureSfsOrderPricingSnapshot } from '@/lib/sfs/order-pricing-snapshot'

const EDITABLE_STATUSES = ['PENDING', 'QUOTED', 'CANCELLED'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return sfsApprovalForbiddenResponse(access.status)

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: { designAttachments: { select: { id: true, storageKey: true, fileName: true, mimeType: true, sizeBytes: true } } },
  })

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!EDITABLE_STATUSES.includes(order.status as typeof EDITABLE_STATUSES[number])) {
    return NextResponse.json({ error: 'Order cannot be edited in its current status' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = sfsOrderInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const specError = await validateSfsOrderSpecOptions(parsed.data)
  if (specError) {
    return NextResponse.json({ error: specError }, { status: 400 })
  }

  const attachmentRefs = designUploadRefsFromInput(parsed.data.diamonds)
  const diamonds = diamondsJsonForPersistence(parsed.data.diamonds).map((d, i) => ({
    ...d,
    code: `${order.sampleCode}D${String(i + 1).padStart(2, '0')}`,
  }))

  const {
    memorialName,
    relationship,
    clientName,
    contactNumber,
    email,
    mailingAddress,
    sourceType,
    sourceOther,
    remarks,
    mailingPackage,
    mailingCompany,
    mailTrackingCode,
    color,
  } = parsed.data

  const previousKeys = order.designAttachments.map(a => a.storageKey)

  let updated: { next: { id: string; sampleCode: string | null }; orphanedKeys: string[] }
  try {
    updated = await prisma.$transaction(async tx => {
    const existingAttachmentIds = attachmentRefs.flatMap(ref => ref.attachmentId ? [ref.attachmentId] : [])
    if (new Set(existingAttachmentIds).size !== existingAttachmentIds.length) {
      throw new Error('A design attachment can only be used once')
    }
    const existingById = new Map(order.designAttachments.map(attachment => [attachment.id, attachment]))
    if (existingAttachmentIds.some(attachmentId => !existingById.has(attachmentId))) {
      throw new Error('One or more design attachments are unavailable')
    }
    const pendingAttachments = await claimPendingDesignUploads(tx, attachmentRefs, {
      userId: session.user.id,
      draftTokenHash: hashSfsDesignDraftToken(req.cookies.get(SFS_DESIGN_DRAFT_COOKIE)?.value),
    })
    const existingAttachments = attachmentRefs.flatMap(ref => {
      if (!ref.attachmentId) return []
      const attachment = existingById.get(ref.attachmentId)!
      return [{
        diamondIndex: ref.diamondIndex,
        storageKey: attachment.storageKey,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      }]
    })
    const attachmentRows = [...existingAttachments, ...pendingAttachments]
    const nextKeys = new Set(attachmentRows.map(attachment => attachment.storageKey))
    const orphanedKeys = previousKeys.filter(key => !nextKeys.has(key))
    await tx.sfsOrderDesignAttachment.deleteMany({ where: { orderId: id } })

    const pricingSnapshot = await captureSfsOrderPricingSnapshot({
      diamonds,
      sourceType,
      color,
      customerId: order.customerId,
    })

    const next = await tx.sfsOrder.update({
      where: { id },
      data: {
        memorialName,
        relationship,
        clientName,
        contactNumber,
        email,
        mailingAddress,
        sourceType,
        sourceOther,
        remarks,
        mailingPackage,
        mailingCompany: mailingCompany?.trim() || null,
        mailTrackingCode: mailTrackingCode?.trim() || null,
        color,
        diamonds,
        pricingSnapshot,
        ...(order.status === 'CANCELLED' && { status: 'PENDING' }),
        // Re-edit clears staff quote until they re-quote
        quotedAmount: null,
        quotedAt: null,
        quoteNotes: null,
        designAttachments: attachmentRows.length
          ? {
              create: attachmentRows.map(row => ({
                diamondIndex: row.diamondIndex,
                storageKey: row.storageKey,
                fileName: row.fileName,
                mimeType: row.mimeType,
                sizeBytes: row.sizeBytes,
              })),
            }
          : undefined,
      },
    })

    await tx.user.update({
      where: { id: session.user.id },
      data: { phone: contactNumber, mailingAddress },
    })

    return { next, orphanedKeys }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update order'
    if (message.includes('design upload') || message.includes('design attachment')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[sfs-order] update failed', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }

  await Promise.allSettled(updated.orphanedKeys.map(key => deleteSfsDesignFile(key)))

  return NextResponse.json({ orderId: updated.next.id, sampleCode: updated.next.sampleCode })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return sfsApprovalForbiddenResponse(access.status)

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: { designAttachments: { orderBy: [{ diamondIndex: 'asc' }, { uploadedAt: 'asc' }] } },
  })

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...order,
    designAttachments: order.designAttachments.map(attachment => ({
      id: attachment.id,
      orderId: attachment.orderId,
      diamondIndex: attachment.diamondIndex,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt,
    })),
  })
}
