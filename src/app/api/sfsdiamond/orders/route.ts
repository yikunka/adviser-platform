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

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Next sequential sample code inside a transaction: SFSB000001, SFSB000002, … */
async function generateSampleCode(tx: TxClient): Promise<string> {
  const last = await tx.sfsOrder.findFirst({
    where: { sampleCode: { startsWith: 'SFSB' } },
    orderBy: { sampleCode: 'desc' },
    select: { sampleCode: true },
  })
  const lastNum = last?.sampleCode ? parseInt(last.sampleCode.slice(4), 10) : 0
  const next = (Number.isNaN(lastNum) ? 0 : lastNum) + 1
  return `SFSB${String(next).padStart(6, '0')}`
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2002'
  )
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

  const attachmentRefs = designUploadRefsFromInput(parsed.data.diamonds)
  if (attachmentRefs.some(ref => ref.attachmentId)) {
    return NextResponse.json({ error: 'Existing design attachments cannot be used for a new order' }, { status: 400 })
  }

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

  let order: { id: string; sampleCode: string | null } | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      order = await prisma.$transaction(async tx => {
        const sampleCode = await generateSampleCode(tx)
        const diamonds = diamondsJsonForPersistence(parsed.data.diamonds).map((d, i) => ({
          ...d,
          code: `${sampleCode}D${String(i + 1).padStart(2, '0')}`,
        }))

        const linkedUser = linkedUserId
          ? await tx.user.findUnique({
              where: { id: linkedUserId },
              select: { id: true, nameEn: true, email: true, phone: true, mailingAddress: true },
            })
          : null

        const attachmentRows = await claimPendingDesignUploads(tx, attachmentRefs, {
          userId: linkedUser?.id ?? null,
          draftTokenHash: hashSfsDesignDraftToken(req.cookies.get(SFS_DESIGN_DRAFT_COOKIE)?.value),
        })

        // Partner CRM must not be overwritten by memorial/order form client fields.
        let customer: { id: string }
        if (linkedUser) {
          const existing = await tx.sfsCustomer.findUnique({ where: { userId: linkedUser.id } })
          if (existing) {
            const patch: { phone?: string; mailingAddress?: string } = {}
            if (!existing.phone?.trim() && contactNumber.trim()) patch.phone = contactNumber
            if (!existing.mailingAddress?.trim() && mailingAddress.trim()) {
              patch.mailingAddress = mailingAddress
            }
            customer = Object.keys(patch).length
              ? await tx.sfsCustomer.update({ where: { id: existing.id }, data: patch })
              : existing
          } else {
            customer = await tx.sfsCustomer.create({
              data: {
                userId: linkedUser.id,
                name: linkedUser.nameEn || clientName,
                email: linkedUser.email || email,
                phone: contactNumber,
                mailingAddress,
              },
            })
          }
        } else {
          customer = await tx.sfsCustomer.create({
            data: {
              name: clientName,
              email,
              phone: contactNumber,
              mailingAddress,
            },
          })
        }

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
          const userPatch: { phone?: string; mailingAddress?: string } = {}
          if (!linkedUser.phone?.trim() && contactNumber.trim()) userPatch.phone = contactNumber
          if (!linkedUser.mailingAddress?.trim() && mailingAddress.trim()) {
            userPatch.mailingAddress = mailingAddress
          }
          if (Object.keys(userPatch).length) {
            await tx.user.update({ where: { id: linkedUser.id }, data: userPatch })
          }
        }

        return created
      })
      break
    } catch (error) {
      lastError = error
      if (isUniqueViolation(error)) continue
      const message = error instanceof Error ? error.message : 'Failed to create order'
      if (message.includes('design upload')) {
        return NextResponse.json({ error: message }, { status: 400 })
      }
      console.error('[sfs-order] create failed', error)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
  }

  if (!order) {
    console.error('[sfs-order] sampleCode collision retries exhausted', lastError)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  return NextResponse.json({ orderId: order.id, sampleCode: order.sampleCode }, { status: 201 })
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
