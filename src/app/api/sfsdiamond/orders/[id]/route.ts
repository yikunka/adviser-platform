import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { sfsOrderInputSchema, validateSfsOrderSpecOptions } from '@/lib/sfs/order-input'

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
  const order = await prisma.sfsOrder.findUnique({ where: { id } })

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
