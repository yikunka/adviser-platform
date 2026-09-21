import { Prisma, type JmmDocumentKind } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { decimalToNumber, lineAmount } from '@/lib/jmm/orders'

const PREFIX: Record<JmmDocumentKind, string> = {
  QUOTATION: 'JMM-QT',
  PROFORMA: 'JMM-PI',
  COMMERCIAL_INVOICE: 'JMM-CI',
}

const NEXT_KIND: Partial<Record<JmmDocumentKind, JmmDocumentKind>> = {
  QUOTATION: 'PROFORMA',
  PROFORMA: 'COMMERCIAL_INVOICE',
}

export async function nextJmmDocumentNumber(kind: JmmDocumentKind, now = new Date(), db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
  const prefix = `${PREFIX[kind]}-${now.getFullYear()}-`
  const latest = await db.jmmDocument.findFirst({
    where: { documentNumber: { startsWith: prefix } },
    orderBy: { documentNumber: 'desc' },
    select: { documentNumber: true },
  })
  const current = latest ? Number(latest.documentNumber.slice(prefix.length)) : 0
  const next = Number.isFinite(current) ? current + 1 : 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

function live(kind: JmmDocumentKind, orderId: string): Prisma.JmmDocumentWhereInput {
  return { orderId, kind, status: { not: 'CANCELLED' } }
}

export async function createJmmQuotation(orderId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.jmmDocument.findFirst({ where: live('QUOTATION', orderId), select: { id: true } })
        if (existing) throw new Error('A quotation is already open. Cancel it before creating another.')

        const order = await tx.jmmOrder.findUnique({
          where: { id: orderId },
          include: { customer: true, lines: { orderBy: { sortOrder: 'asc' } } },
        })
        if (!order) throw new Error('Order not found')
        if (order.lines.length === 0) throw new Error('Add at least one order line first')

        return tx.jmmDocument.create({
          data: {
            orderId,
            kind: 'QUOTATION',
            status: 'DRAFT',
            documentNumber: await nextJmmDocumentNumber('QUOTATION', order.orderDate, tx),
            documentDate: order.orderDate,
            currency: order.currency,
            customerName: order.customer.name,
            company: order.customer.company,
            vatNumber: order.customer.vatNumber,
            deliveryAddress: order.customer.deliveryAddress,
            notes: order.notes,
            lines: {
              create: order.lines.map(line => ({
                sortOrder: line.sortOrder,
                description: line.description,
                quantity: line.quantity,
                unit: line.unit,
                unitPrice: line.unitPrice,
                amount: line.amount,
              })),
            },
          },
          select: { id: true, documentNumber: true },
        })
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 2) continue
      throw err
    }
  }
  throw new Error('Could not allocate a document number')
}

export async function advanceJmmDocument(orderId: string, target: 'PROFORMA' | 'COMMERCIAL_INVOICE') {
  const sourceKind: JmmDocumentKind = target === 'PROFORMA' ? 'QUOTATION' : 'PROFORMA'
  const blocked = target === 'PROFORMA'
    ? 'A proforma invoice is already open. Cancel it before creating another.'
    : 'A commercial invoice is already open. Cancel it before creating another.'

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.jmmDocument.findFirst({ where: live(target, orderId), select: { id: true } })
        if (existing) throw new Error(blocked)

        const source = await tx.jmmDocument.findFirst({
          where: { orderId, kind: sourceKind, status: { in: ['DRAFT', 'ACCEPTED'] } },
          include: { lines: { orderBy: { sortOrder: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        })
        if (!source) {
          throw new Error(sourceKind === 'QUOTATION' ? 'Create a quotation first' : 'Create a proforma invoice first')
        }
        if (source.lines.length === 0) throw new Error('The source document has no lines')

        if (source.status === 'DRAFT') {
          await tx.jmmDocument.update({ where: { id: source.id }, data: { status: 'ACCEPTED' } })
        }

        return tx.jmmDocument.create({
          data: {
            orderId,
            kind: target,
            status: 'DRAFT',
            documentNumber: await nextJmmDocumentNumber(target, new Date(), tx),
            sourceDocumentId: source.id,
            documentDate: new Date(),
            currency: source.currency,
            customerName: source.customerName,
            company: source.company,
            vatNumber: source.vatNumber,
            deliveryAddress: source.deliveryAddress,
            notes: source.notes,
            lines: {
              create: source.lines.map(line => ({
                sortOrder: line.sortOrder,
                description: line.description,
                quantity: line.quantity,
                unit: line.unit,
                unitPrice: line.unitPrice,
                amount: line.amount,
              })),
            },
          },
          select: { id: true, documentNumber: true },
        })
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 2) continue
      throw err
    }
  }
  throw new Error('Could not allocate a document number')
}

export async function cancelJmmDocument(documentId: string) {
  const doc = await prisma.jmmDocument.findUnique({ where: { id: documentId } })
  if (!doc) throw new Error('Document not found')
  if (doc.status === 'CANCELLED') return doc

  const child = await prisma.jmmDocument.findFirst({
    where: { sourceDocumentId: documentId, status: { not: 'CANCELLED' } },
    select: { documentNumber: true },
  })
  if (child) {
    throw new Error(`Cancel ${child.documentNumber} first`)
  }

  return prisma.jmmDocument.update({
    where: { id: documentId },
    data: { status: 'CANCELLED' },
  })
}

export function documentLineData(lines: { description: string; quantity: number; unit: string; unitPrice: number }[]) {
  return lines.map((line, index) => ({
    sortOrder: index,
    description: line.description,
    quantity: new Prisma.Decimal(line.quantity),
    unit: line.unit,
    unitPrice: new Prisma.Decimal(line.unitPrice),
    amount: lineAmount(line.quantity, line.unitPrice),
  }))
}

export function serializeJmmDocument(doc: {
  id: string
  kind: JmmDocumentKind
  status: string
  documentNumber: string
  documentDate: Date
  currency: string
  customerName: string
  company: string
  vatNumber: string
  deliveryAddress: string
  notes: string
  sourceDocumentId: string | null
  lines: { id: string; description: string; quantity: Prisma.Decimal; unit: string; unitPrice: Prisma.Decimal; amount: Prisma.Decimal }[]
}) {
  const total = doc.lines.reduce((sum, line) => sum + decimalToNumber(line.amount), 0)
  return {
    id: doc.id,
    kind: doc.kind,
    status: doc.status,
    documentNumber: doc.documentNumber,
    documentDate: doc.documentDate.toISOString().slice(0, 10),
    currency: doc.currency,
    customerName: doc.customerName,
    company: doc.company,
    vatNumber: doc.vatNumber,
    deliveryAddress: doc.deliveryAddress,
    notes: doc.notes,
    sourceDocumentId: doc.sourceDocumentId,
    nextKind: NEXT_KIND[doc.kind] ?? null,
    total: Math.round(total * 100) / 100,
    lines: doc.lines.map(line => ({
      id: line.id,
      description: line.description,
      quantity: decimalToNumber(line.quantity),
      unit: line.unit,
      unitPrice: decimalToNumber(line.unitPrice),
      amount: decimalToNumber(line.amount),
    })),
  }
}
