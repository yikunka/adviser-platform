import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getSfsAccountAccess, sfsApprovalForbiddenResponse } from '@/lib/sfs/account-approval'
import { logAudit } from '@/lib/audit/logger'

const schema = z.object({
  action: z.enum(['ACCEPT', 'REQUEST_CHANGE']),
  note: z.string().trim().max(2000).optional(),
})

/**
 * POST /api/sfsdiamond/orders/[id]/quote-response
 * Partner accepts a quote (→ CONFIRMED) or asks for a change (→ PENDING with note).
 */
export async function POST(
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
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const order = await prisma.sfsOrder.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      quotedAmount: true,
      quoteNotes: true,
      adminNotes: true,
      customerRemark: true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'QUOTED') {
    return NextResponse.json({ error: 'Only a quoted order can be accepted or sent back.' }, { status: 400 })
  }
  if (order.quotedAmount == null) {
    return NextResponse.json({ error: 'This quote has no amount yet.' }, { status: 400 })
  }

  if (parsed.data.action === 'ACCEPT') {
    const updated = await prisma.sfsOrder.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED' },
      select: { id: true, status: true },
    })
    await logAudit(session.user.id, 'SFS_QUOTE_ACCEPT', 'SfsOrder', order.id, { status: order.status }, { status: updated.status })
    return NextResponse.json(updated)
  }

  const note = parsed.data.note?.trim()
  if (!note) {
    return NextResponse.json({ error: 'Please describe the change you need.' }, { status: 400 })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const remarkLine = `[${stamp}] Partner requested quote change: ${note}`
  const updated = await prisma.sfsOrder.update({
    where: { id: order.id },
    data: {
      status: 'PENDING',
      customerRemark: order.customerRemark
        ? `${order.customerRemark}\n${remarkLine}`
        : remarkLine,
      adminNotes: order.adminNotes
        ? `${order.adminNotes}\n${remarkLine}`
        : remarkLine,
    },
    select: { id: true, status: true },
  })
  await logAudit(
    session.user.id,
    'SFS_QUOTE_CHANGE_REQUEST',
    'SfsOrder',
    order.id,
    { status: order.status },
    { status: updated.status, note },
  )
  return NextResponse.json(updated)
}
