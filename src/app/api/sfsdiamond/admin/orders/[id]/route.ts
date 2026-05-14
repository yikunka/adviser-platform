import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

const updateSchema = z.object({
  status:               z.enum(['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  adminNotes:           z.string().nullable().optional(),
  customerRemark:       z.string().nullable().optional(),
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
  const session = await auth()
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: {
      steps: { orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }] },
      user: { select: { nameEn: true, email: true } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { status, adminNotes, customerRemark, ...dates } = parsed.data
  const order = await prisma.sfsOrder.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
      ...(customerRemark !== undefined && { customerRemark }),
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

  return NextResponse.json(order)
}
