import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import {
  designAttachmentsFromInput,
  diamondsJsonForPersistence,
  sfsOrderInputSchema,
  validateSfsOrderSpecOptions,
} from '@/lib/sfs/order-input'
import { deleteFromR2 } from '@/lib/storage/r2'

const EDITABLE_STATUSES = ['PENDING', 'QUOTED', 'CANCELLED'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: { designAttachments: { select: { id: true, storageKey: true } } },
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

  const attachmentRows = designAttachmentsFromInput(parsed.data.diamonds)
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
    color,
  } = parsed.data

  const previousKeys = order.designAttachments.map(a => a.storageKey)
  const nextKeys = new Set(attachmentRows.map(a => a.storageKey))
  const orphanedKeys = previousKeys.filter(key => !nextKeys.has(key))

  const updated = await prisma.$transaction(async tx => {
    await tx.sfsOrderDesignAttachment.deleteMany({ where: { orderId: id } })

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
        color,
        diamonds,
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

    return next
  })

  await Promise.allSettled(orphanedKeys.map(key => deleteFromR2(key)))

  return NextResponse.json({ orderId: updated.id, sampleCode: updated.sampleCode })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: { designAttachments: { orderBy: [{ diamondIndex: 'asc' }, { uploadedAt: 'asc' }] } },
  })

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}
