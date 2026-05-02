import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const schema = z.object({
  orderType: z.enum(['INCORPORATION', 'REGISTERED_ADDRESS', 'ANNUAL_RETURN', 'ACCOUNTING', 'ADVISORY']),
  description: z.string().max(1000).optional(),
  companyId: z.string().cuid().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const order = await prisma.serviceOrder.create({
    data: {
      userId: session.user.id,
      orderType: parsed.data.orderType,
      formData: { description: parsed.data.description ?? '' },
      notes: parsed.data.description,
      companyId: parsed.data.companyId,
    },
  })

  return NextResponse.json({ orderId: order.id }, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await prisma.serviceOrder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}
