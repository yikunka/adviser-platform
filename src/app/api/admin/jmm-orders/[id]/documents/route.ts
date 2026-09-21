import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { advanceJmmDocument, createJmmQuotation, serializeJmmDocument } from '@/lib/jmm/documents'

const createSchema = z.object({
  action: z.enum(['QUOTATION', 'PROFORMA', 'COMMERCIAL_INVOICE']),
})

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error

  const { id } = await ctx.params
  const order = await prisma.jmmOrder.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const documents = await prisma.jmmDocument.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'asc' },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  })

  const open = (kind: 'QUOTATION' | 'PROFORMA' | 'COMMERCIAL_INVOICE') =>
    documents.some(doc => doc.kind === kind && doc.status !== 'CANCELLED')
  const quotation = documents.find(doc => doc.kind === 'QUOTATION' && doc.status !== 'CANCELLED')
  const proforma = documents.find(doc => doc.kind === 'PROFORMA' && doc.status !== 'CANCELLED')

  return NextResponse.json({
    documents: documents.map(serializeJmmDocument),
    actions: {
      createQuotation: !open('QUOTATION'),
      createProforma: Boolean(quotation) && !open('PROFORMA'),
      createInvoice: Boolean(proforma) && !open('COMMERCIAL_INVOICE'),
    },
  })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error

  const { id } = await ctx.params
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const order = await prisma.jmmOrder.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const created = parsed.data.action === 'QUOTATION'
      ? await createJmmQuotation(id)
      : await advanceJmmDocument(id, parsed.data.action)
    await logAudit(session.user.id, 'JMM_DOCUMENT_CREATE', 'JmmDocument', created.id, null, {
      documentNumber: created.documentNumber,
      action: parsed.data.action,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create document'
    const status = message === 'Order not found' ? 404 : 409
    return NextResponse.json({ error: message }, { status })
  }
}
