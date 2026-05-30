import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { computeTotals, toMoney, toQuantity, toTaxRate } from '@/lib/invoice/calc'
import { sfsOrderBillingSnapshot } from '@/lib/sfs-invoice/order-billing'
import { nextSfsInvoiceNumber } from '@/lib/sfs-invoice/number'
import { z } from 'zod'

const lineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999999),
  unitPrice: z.number().min(0).max(999999999),
})

const createSchema = z.object({
  orderId: z.string().cuid().optional().nullable(),
  issueDate: z.string(),
  dueDate: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).default('HKD'),
  taxRate: z.number().min(0).max(1).default(0),
  billToName: z.string().min(1).max(200).optional(),
  billToAddress: z.string().max(500).optional().nullable(),
  billToEmail: z.union([z.string().email().max(320), z.literal('')]).optional().nullable(),
  billToPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
  lineItems: z.array(lineSchema).min(1),
})

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const skip = (page - 1) * limit

  const where = {
    ...(orderId ? { orderId } : {}),
    ...(status ? { status: status as 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
            { billToName: { contains: search, mode: 'insensitive' as const } },
            { billToEmail: { contains: search, mode: 'insensitive' as const } },
            { order: { memorialName: { contains: search, mode: 'insensitive' as const } } },
            { order: { sampleCode: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.sfsInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { issueDate: 'desc' },
      include: {
        order: { select: { id: true, memorialName: true, sampleCode: true, clientName: true } },
        createdBy: { select: { nameEn: true } },
      },
    }),
    prisma.sfsInvoice.count({ where }),
  ])

  return NextResponse.json({ invoices, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  let billing: Awaited<ReturnType<typeof sfsOrderBillingSnapshot>> = null
  if (parsed.data.orderId) {
    const order = await prisma.sfsOrder.findUnique({ where: { id: parsed.data.orderId } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    billing = await sfsOrderBillingSnapshot(parsed.data.orderId)
  }

  const issueDate = new Date(parsed.data.issueDate)
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  const { subtotal, taxAmount, total, lineAmounts } = computeTotals(
    parsed.data.lineItems,
    parsed.data.taxRate,
  )

  const billToName = (parsed.data.billToName ?? billing?.billToName ?? '').trim()
  if (!billToName) {
    return NextResponse.json({ error: 'Bill to name is required' }, { status: 400 })
  }

  const invoiceNumber = await nextSfsInvoiceNumber(issueDate)

  const invoice = await prisma.sfsInvoice.create({
    data: {
      invoiceNumber,
      orderId: parsed.data.orderId ?? null,
      status: parsed.data.status ?? 'DRAFT',
      issueDate,
      dueDate,
      currency: parsed.data.currency,
      billToName,
      billToAddress: parsed.data.billToAddress ?? billing?.billToAddress ?? null,
      billToEmail:
        (parsed.data.billToEmail && parsed.data.billToEmail !== ''
          ? parsed.data.billToEmail
          : null) ?? billing?.billToEmail ?? null,
      billToPhone: parsed.data.billToPhone ?? billing?.billToPhone ?? null,
      subtotal: toMoney(subtotal),
      taxRate: toTaxRate(parsed.data.taxRate),
      taxAmount: toMoney(taxAmount),
      total: toMoney(total),
      notes: parsed.data.notes ?? null,
      createdById: session!.user.id,
      lineItems: {
        create: parsed.data.lineItems.map((line, i) => ({
          sortOrder: i,
          description: line.description,
          quantity: toQuantity(line.quantity),
          unitPrice: toMoney(line.unitPrice),
          amount: toMoney(lineAmounts[i]!),
        })),
      },
    },
    include: {
      lineItems: { orderBy: { sortOrder: 'asc' } },
      order: { select: { id: true, memorialName: true, sampleCode: true, clientName: true } },
      createdBy: { select: { nameEn: true } },
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'SfsInvoice', invoice.id, null, invoice)
  return NextResponse.json(invoice, { status: 201 })
}
