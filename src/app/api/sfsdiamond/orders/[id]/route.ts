import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const EDITABLE_STATUSES = ['PENDING', 'QUOTED', 'CANCELLED'] as const

const diamondItemSchema = z.object({
  carat:    z.enum(['1.0', '1.5', '2.0', '2.5', '3.0']),
  shape:    z.enum(['Round', 'Oval', 'Heart', 'Octagon', 'Cushion Square', 'Princess']),
  type:     z.enum(['Ring', 'Necklace', 'Diamond only']),
  ringSize: z.string().optional(),
  design:   z.string().optional(),
  metal:    z.enum(['Platinum', 'Yellow Gold', 'Rose Gold', 'White Gold']).optional(),
})

const patchSchema = z.object({
  memorialName:  z.string().min(1),
  relationship:  z.string().min(1),
  clientName:    z.string().min(1),
  contactNumber: z.string().min(1),
  email:         z.string().email(),
  mailingAddress:z.string().min(1),
  sourceType:    z.string().min(1),
  sourceOther:   z.string().optional(),
  remarks:       z.string().optional(),
  mailingPackage:z.string().min(1),
  color:         z.string().min(1),
  diamonds:      z.array(diamondItemSchema).min(1).max(8),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.sfsOrder.findUnique({ where: { id } })

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!EDITABLE_STATUSES.includes(order.status as typeof EDITABLE_STATUSES[number])) {
    return NextResponse.json({ error: 'Order cannot be edited in its current status' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // Re-attach diamond codes using the original sampleCode
  const diamonds = parsed.data.diamonds.map((d, i) => ({
    ...d,
    code: `${order.sampleCode}D${String(i + 1).padStart(2, '0')}`,
  }))

  const { contactNumber, mailingAddress } = parsed.data

  const [updated] = await prisma.$transaction([
    prisma.sfsOrder.update({
      where: { id },
      data: {
        ...parsed.data,
        diamonds,
        // Reactivate a cancelled order when the client resubmits
        ...(order.status === 'CANCELLED' && { status: 'PENDING' }),
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { phone: contactNumber, mailingAddress },
    }),
  ])

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
  const order = await prisma.sfsOrder.findUnique({ where: { id } })

  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}
