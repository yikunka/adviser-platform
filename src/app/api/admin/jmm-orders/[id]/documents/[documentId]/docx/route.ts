import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { contentDispositionHeader } from '@/lib/http/content-disposition'
import { decimalToNumber } from '@/lib/jmm/orders'
import { buildJmmTradeDocx } from '@/lib/jmm/trade-docx'

type Ctx = { params: Promise<{ id: string; documentId: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireRole('STAFF', { adminMenu: 'jmmOrders' })
  if (error) return error

  const { id, documentId } = await ctx.params
  const doc = await prisma.jmmDocument.findFirst({
    where: { id: documentId, orderId: id },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buffer = await buildJmmTradeDocx({
    kind: doc.kind,
    documentNumber: doc.documentNumber,
    status: doc.status,
    documentDate: doc.documentDate.toISOString().slice(0, 10),
    currency: doc.currency,
    customerName: doc.customerName,
    company: doc.company,
    vatNumber: doc.vatNumber,
    deliveryAddress: doc.deliveryAddress,
    notes: doc.notes,
    lines: doc.lines.map(line => ({
      description: line.description,
      packing: line.unit,
      quantity: decimalToNumber(line.quantity),
      unitPrice: decimalToNumber(line.unitPrice),
      amount: decimalToNumber(line.amount),
    })),
  })

  const fileName = `${doc.documentNumber}.docx`
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': contentDispositionHeader('attachment', fileName),
    },
  })
}
