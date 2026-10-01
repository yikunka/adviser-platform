import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import {
  designUploadRefsFromInput,
  diamondsJsonForPersistence,
  sfsOrderInputSchema,
  validateSfsOrderSpecOptions,
} from '@/lib/sfs/order-input'
import { claimPendingDesignUploads, hashSfsDesignDraftToken, SFS_DESIGN_DRAFT_COOKIE } from '@/lib/sfs/pending-design-uploads'
import { getSfsAccountAccess, sfsApprovalForbiddenResponse } from '@/lib/sfs/account-approval'
import { captureSfsOrderPricingSnapshot } from '@/lib/sfs/order-pricing-snapshot'

// Generate next sequential sample code: SFSB000001, SFSB000002, …
async function generateSampleCode(): Promise<string> {
  const last = await prisma.sfsOrder.findFirst({
    where: { sampleCode: { startsWith: 'SFSB' } },
    orderBy: { sampleCode: 'desc' },
    select: { sampleCode: true },
  })
  const lastNum = last?.sampleCode ? parseInt(last.sampleCode.slice(4), 10) : 0
  const next = (isNaN(lastNum) ? 0 : lastNum) + 1
  return `SFSB${String(next).padStart(6, '0')}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Partner login is required to place an order.' }, { status: 401 })
  }
  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return sfsApprovalForbiddenResponse(access.status)
  const linkedUserId = session.user.id

  const body = await req.json().catch(() => null)
  const parsed = sfsOrderInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const specError = await validateSfsOrderSpecOptions(parsed.data)
  if (specError) {
    return NextResponse.json({ error: specError }, { status: 400 })
  }

  const sampleCode = await generateSampleCode()
  const attachmentRefs = designUploadRefsFromInput(parsed.data.diamonds)
  if (attachmentRefs.some(ref => ref.attachmentId)) {
    return NextResponse.json({ error: 'Existing design attachments cannot be used for a new order' }, { status: 400 })
  }

  const diamonds = diamondsJsonForPersistence(parsed.data.diamonds).map((d, i) => ({
    ...d,
    code: `${sampleCode}D${String(i + 1).padStart(2, '0')}`,
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

  let order: { id: string; sampleCode: string | null }
  try {
    order = await prisma.$transaction(async tx => {
    const linkedUser = linkedUserId
      ? await tx.user.findUnique({
          where: { id: linkedUserId },
          select: { id: true },
        })
      : null

    const attachmentRows = await claimPendingDesignUploads(tx, attachmentRefs, {
      userId: linkedUser?.id ?? null,
      draftTokenHash: hashSfsDesignDraftToken(req.cookies.get(SFS_DESIGN_DRAFT_COOKIE)?.value),
    })

    const customer = linkedUser
      ? await tx.sfsCustomer.upsert({
          where: { userId: linkedUser.id },
          create: {
            userId: linkedUser.id,
            name: clientName,
            email,
            phone: contactNumber,
            mailingAddress,
          },
          update: {
            name: clientName,
            email,
            phone: contactNumber,
            mailingAddress,
          },
        })
      : await tx.sfsCustomer.create({
          data: {
            name: clientName,
            email,
            phone: contactNumber,
            mailingAddress,
          },
        })

    const pricingSnapshot = await captureSfsOrderPricingSnapshot({
      diamonds,
      sourceType,
      color,
      customerId: customer.id,
    })

    const created = await tx.sfsOrder.create({
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
        date: new Date().toISOString().slice(0, 10),
        sampleCode,
        diamonds,
        pricingSnapshot,
        userId: linkedUser?.id ?? null,
        customerId: customer.id,
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

    if (linkedUser) {
      await tx.user.update({
        where: { id: linkedUser.id },
        data: { phone: contactNumber, mailingAddress },
      })
    }

    return created
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order'
    if (message.includes('design upload')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[sfs-order] create failed', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  return NextResponse.json({ orderId: order.id, sampleCode }, { status: 201 })
}

export async function GET() {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return sfsApprovalForbiddenResponse(access.status)

  const orders = await prisma.sfsOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}
