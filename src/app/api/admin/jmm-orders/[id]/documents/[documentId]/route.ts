import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { JMM_CURRENCIES } from '@/lib/jmm/orders'
import { cancelJmmDocument, documentLineData } from '@/lib/jmm/documents'

const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().max(40).optional().default(''),
  unitPrice: z.number().min(0).max(1_000_000_000),
})

const updateSchema = z.object({
  action: z.literal('UPDATE'),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(JMM_CURRENCIES),
  customerName: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).optional().default(''),
  vatNumber: z.string().trim().max(80).optional().default(''),
  deliveryAddress: z.string().trim().max(500).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  lines: z.array(lineSchema).min(1).max(100),
})

const cancelSchema = z.object({ action: z.literal('CANCEL') })

type Ctx = { params: Promise<{ id: string; documentId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requirePermission('jmmOrders.edit')
  if (error || !session) return error

  const { id, documentId } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = z.union([updateSchema, cancelSchema]).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid document' }, { status: 400 })

  const doc = await prisma.jmmDocument.findFirst({ where: { id: documentId, orderId: id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    if (parsed.data.action === 'CANCEL') {
      await cancelJmmDocument(documentId)
      await logAudit(session.user.id, 'JMM_DOCUMENT_CANCEL', 'JmmDocument', documentId, {
        documentNumber: doc.documentNumber,
        status: doc.status,
      }, { status: 'CANCELLED' })
      return NextResponse.json({ id: documentId })
    }

    if (doc.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only a draft document can be edited' }, { status: 409 })
    }

    const data = parsed.data
    await prisma.$transaction([
      prisma.jmmDocumentLine.deleteMany({ where: { documentId } }),
      prisma.jmmDocument.update({
        where: { id: documentId },
        data: {
          documentDate: new Date(`${data.documentDate}T00:00:00.000Z`),
          currency: data.currency,
          customerName: data.customerName,
          company: data.company,
          vatNumber: data.vatNumber,
          deliveryAddress: data.deliveryAddress,
          notes: data.notes,
          lines: { create: documentLineData(data.lines) },
        },
      }),
    ])
    await logAudit(session.user.id, 'JMM_DOCUMENT_UPDATE', 'JmmDocument', documentId, {
      documentNumber: doc.documentNumber,
    }, { documentNumber: doc.documentNumber })
    return NextResponse.json({ id: documentId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update document'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
