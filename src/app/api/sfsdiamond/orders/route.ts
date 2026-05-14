import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const diamondItemSchema = z.object({
  carat:    z.enum(['1.0', '1.5', '2.0', '2.5', '3.0']),
  shape:    z.enum(['Round', 'Oval', 'Heart', 'Octagon', 'Cushion Square', 'Princess']),
  type:     z.enum(['Ring', 'Necklace', 'Diamond only']),
  ringSize: z.string().optional(),
  design:   z.string().optional(),
  metal:    z.enum(['Platinum', 'Yellow Gold', 'Rose Gold', 'White Gold']).optional(),
})

const schema = z.object({
  date:          z.string().min(1),
  sampleCode:    z.string().optional(),
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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const order = await prisma.sfsOrder.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return NextResponse.json({ orderId: order.id }, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orders = await prisma.sfsOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}
