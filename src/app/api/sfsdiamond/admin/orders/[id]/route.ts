import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { deleteFromR2, deleteSfsDesignFile } from '@/lib/storage/r2'
import { z } from 'zod'
import { resolveOrderStepPlan } from '@/lib/sfs/order-step-plan'

const updateSchema = z.object({
  status:               z.enum(['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  adminNotes:           z.string().nullable().optional(),
  customerRemark:       z.string().nullable().optional(),
  quotedAmount:         z.union([z.number().nonnegative(), z.null()]).optional(),
  quoteNotes:           z.string().nullable().optional(),
  sampleReceivedAt:     z.string().datetime().nullable().optional(),
  chemTransformStartAt: z.string().datetime().nullable().optional(),
  chemTransformEndAt:   z.string().datetime().nullable().optional(),
  cvdStartAt:           z.string().datetime().nullable().optional(),
  cvdExpectedEndAt:     z.string().datetime().nullable().optional(),
  cvdEndAt:             z.string().datetime().nullable().optional(),
  craftingStartAt:      z.string().datetime().nullable().optional(),
  craftingEndAt:        z.string().datetime().nullable().optional(),
  igiCertificationAt:   z.string().datetime().nullable().optional(),
  jewelrySettingStartAt:z.string().datetime().nullable().optional(),
  jewelrySettingEndAt:  z.string().datetime().nullable().optional(),
  packagingAt:          z.string().datetime().nullable().optional(),
  deliveryAt:           z.string().datetime().nullable().optional(),
  deliveryDetails:      z.string().nullable().optional(),
})

function toDate(v: string | null | undefined) {
  if (v == null) return v
  return new Date(v)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }],
        include: { attachments: { orderBy: { createdAt: 'asc' } } },
      },
      designAttachments: { orderBy: [{ diamondIndex: 'asc' }, { uploadedAt: 'asc' }] },
      user: { select: { nameEn: true, email: true } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
    quotedAmount: order.quotedAmount == null ? null : Number(order.quotedAmount),
    resolvedStepPlan: resolveOrderStepPlan(order.stepPlan),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { status, adminNotes, customerRemark, quotedAmount, quoteNotes, ...dates } = parsed.data

  const existing = await prisma.sfsOrder.findUnique({
    where: { id },
    select: { quotedAmount: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quoteChanged =
    quotedAmount !== undefined
    && (
      quotedAmount === null
        ? existing.quotedAmount != null
        : existing.quotedAmount == null || Number(existing.quotedAmount) !== quotedAmount
    )

  const order = await prisma.sfsOrder.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
      ...(customerRemark !== undefined && { customerRemark }),
      ...(quotedAmount !== undefined && {
        quotedAmount,
        ...(quotedAmount == null
          ? { quotedAt: null }
          : quoteChanged
            ? { quotedAt: new Date() }
            : {}),
      }),
      ...(quoteNotes !== undefined && { quoteNotes }),
      sampleReceivedAt:      toDate(dates.sampleReceivedAt),
      chemTransformStartAt:  toDate(dates.chemTransformStartAt),
      chemTransformEndAt:    toDate(dates.chemTransformEndAt),
      cvdStartAt:            toDate(dates.cvdStartAt),
      cvdExpectedEndAt:      toDate(dates.cvdExpectedEndAt),
      cvdEndAt:              toDate(dates.cvdEndAt),
      craftingStartAt:       toDate(dates.craftingStartAt),
      craftingEndAt:         toDate(dates.craftingEndAt),
      igiCertificationAt:    toDate(dates.igiCertificationAt),
      jewelrySettingStartAt: toDate(dates.jewelrySettingStartAt),
      jewelrySettingEndAt:   toDate(dates.jewelrySettingEndAt),
      packagingAt:           toDate(dates.packagingAt),
      deliveryAt:            toDate(dates.deliveryAt),
      deliveryDetails:       dates.deliveryDetails,
    },
  })

  return NextResponse.json({
    ...order,
    quotedAmount: order.quotedAmount == null ? null : Number(order.quotedAmount),
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission('sfsOrders.delete')
  if (error) return error

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: {
      steps: {
        select: {
          fileKeys: true,
          attachments: { select: { fileKey: true } },
        },
      },
      designAttachments: { select: { storageKey: true } },
      invoices: { select: { id: true, invoiceNumber: true, status: true } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storageKeys = new Set<string>()
  for (const step of order.steps) {
    for (const key of step.fileKeys) storageKeys.add(key)
    for (const attachment of step.attachments) storageKeys.add(attachment.fileKey)
  }
  for (const attachment of order.designAttachments) storageKeys.add(attachment.storageKey)

  await prisma.sfsOrder.delete({ where: { id } })

  const designKeys = new Set(order.designAttachments.map(attachment => attachment.storageKey))
  await Promise.allSettled([
    ...[...storageKeys].filter(key => !designKeys.has(key)).map(key => deleteFromR2(key)),
    ...[...designKeys].map(key => deleteSfsDesignFile(key)),
  ])

  await logAudit(session!.user.id, 'DELETE', 'SfsOrder', id, {
    id: order.id,
    sampleCode: order.sampleCode,
    memorialName: order.memorialName,
    clientName: order.clientName,
    email: order.email,
    status: order.status,
    invoiceIds: order.invoices.map(inv => inv.id),
  }, null)

  return NextResponse.json({ ok: true })
}
