import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { computeTotals, toMoney, toQuantity, toTaxRate } from '@/lib/invoice/calc'
import { z } from 'zod'

const lineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999999),
  weight: z.number().min(0).max(999999).optional().nullable(),
  unitPrice: z.number().min(0).max(999999999),
})

const updateSchema = z.object({
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).optional(),
  taxRate: z.number().min(0).max(1).optional(),
  billToName: z.string().min(1).max(200).optional(),
  billToAddress: z.string().max(500).optional().nullable(),
  billToEmail: z.union([z.string().email().max(320), z.literal('')]).optional().nullable(),
  billToPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
  lineItems: z.array(lineSchema).min(1).optional(),
})

async function loadInvoice(id: string) {
  return prisma.sfsInvoice.findUnique({
    where: { id },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      order: {
        select: { id: true, memorialName: true, sampleCode: true, clientName: true, status: true },
      },
      createdBy: { select: { id: true, nameEn: true, email: true } },
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const { id } = await params
  const invoice = await loadInvoice(id)
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(invoice)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const { id } = await params
  const before = await loadInvoice(id)
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const contentKeys = [
    'issueDate',
    'dueDate',
    'currency',
    'taxRate',
    'billToName',
    'billToAddress',
    'billToEmail',
    'billToPhone',
    'notes',
    'lineItems',
  ] as const
  const wantsContentEdit = contentKeys.some(key => parsed.data[key] !== undefined)
  if (wantsContentEdit && before.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 400 })
  }

  const taxRate = parsed.data.taxRate ?? Number(before.taxRate.toString())
  let subtotal = Number(before.subtotal.toString())
  let taxAmount = Number(before.taxAmount.toString())
  let total = Number(before.total.toString())

  if (parsed.data.lineItems) {
    const totals = computeTotals(parsed.data.lineItems, taxRate)
    subtotal = totals.subtotal
    taxAmount = totals.taxAmount
    total = totals.total
  } else if (parsed.data.taxRate !== undefined) {
    const totals = computeTotals(
      before.lineItems.map(l => ({
        description: l.description,
        quantity: Number(l.quantity.toString()),
        unitPrice: Number(l.unitPrice.toString()),
      })),
      taxRate,
    )
    subtotal = totals.subtotal
    taxAmount = totals.taxAmount
    total = totals.total
  }

  const invoice = await prisma.$transaction(async tx => {
    if (parsed.data.lineItems) {
      await tx.sfsInvoiceLineItem.deleteMany({ where: { invoiceId: id } })
      const { lineAmounts } = computeTotals(parsed.data.lineItems, taxRate)
      await tx.sfsInvoiceLineItem.createMany({
        data: parsed.data.lineItems.map((line, i) => ({
          invoiceId: id,
          sortOrder: i,
          description: line.description,
          quantity: toQuantity(line.quantity),
          weight: line.weight != null ? toQuantity(line.weight) : null,
          unitPrice: toMoney(line.unitPrice),
          amount: toMoney(lineAmounts[i]!),
        })),
      })
    }

    return tx.sfsInvoice.update({
      where: { id },
      data: {
        ...(parsed.data.issueDate !== undefined ? { issueDate: new Date(parsed.data.issueDate) } : {}),
        ...(parsed.data.dueDate !== undefined
          ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
          : {}),
        ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
        ...(parsed.data.billToName !== undefined ? { billToName: parsed.data.billToName } : {}),
        ...(parsed.data.billToAddress !== undefined ? { billToAddress: parsed.data.billToAddress } : {}),
        ...(parsed.data.billToEmail !== undefined ? { billToEmail: parsed.data.billToEmail } : {}),
        ...(parsed.data.billToPhone !== undefined ? { billToPhone: parsed.data.billToPhone } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.taxRate !== undefined || parsed.data.lineItems
          ? {
              taxRate: toTaxRate(taxRate),
              subtotal: toMoney(subtotal),
              taxAmount: toMoney(taxAmount),
              total: toMoney(total),
            }
          : {}),
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        order: { select: { id: true, memorialName: true, sampleCode: true, clientName: true } },
        createdBy: { select: { nameEn: true } },
      },
    })
  })

  await logAudit(session!.user.id, 'UPDATE', 'SfsInvoice', id, before, invoice)
  return NextResponse.json(invoice)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const { id } = await params
  const before = await loadInvoice(id)
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (before.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 400 })
  }

  await prisma.sfsInvoice.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'SfsInvoice', id, before, null)
  return NextResponse.json({ ok: true })
}
