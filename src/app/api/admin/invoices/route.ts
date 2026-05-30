import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  assertCompanyAccessible,
  buildCompanyGroupWhere,
  resolveEntityGroupAccess,
} from '@/lib/entity-groups/access'
import { companyBillingSnapshot } from '@/lib/invoice/company-billing'
import { computeTotals, toMoney, toQuantity, toTaxRate } from '@/lib/invoice/calc'
import { nextInvoiceNumber } from '@/lib/invoice/number'
import { z } from 'zod'

const lineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999999),
  unitPrice: z.number().min(0).max(999999999),
})

const createSchema = z.object({
  companyId: z.string().cuid(),
  issueDate: z.string(),
  dueDate: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).default('HKD'),
  taxRate: z.number().min(0).max(1).default(0),
  billToName: z.string().min(1).max(200).optional(),
  billToAddress: z.string().max(500).optional().nullable(),
  billToEmail: z.union([z.string().email().max(320), z.literal('')]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
  lineItems: z.array(lineSchema).min(1),
})

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status')
  const companyId = searchParams.get('companyId')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const skip = (page - 1) * limit

  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  if (companyId && !(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const companyFilter = buildCompanyGroupWhere(access)
  const where = {
    ...(companyId ? { companyId } : {}),
    ...(status ? { status: status as 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' } : {}),
    ...(companyFilter ? { company: companyFilter } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
            { billToName: { contains: search, mode: 'insensitive' as const } },
            { company: { nameEn: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { issueDate: 'desc' },
      include: {
        company: { select: { id: true, nameEn: true, companyCode: true } },
        createdBy: { select: { nameEn: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return NextResponse.json({ invoices, total, page, limit })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const billing = await companyBillingSnapshot(parsed.data.companyId)
  if (!billing) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const issueDate = new Date(parsed.data.issueDate)
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  const { subtotal, taxAmount, total, lineAmounts } = computeTotals(
    parsed.data.lineItems,
    parsed.data.taxRate,
  )

  const invoiceNumber = await nextInvoiceNumber(issueDate)

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      companyId: parsed.data.companyId,
      status: parsed.data.status ?? 'DRAFT',
      issueDate,
      dueDate,
      currency: parsed.data.currency,
      billToName: parsed.data.billToName ?? billing.billToName,
      billToAddress: parsed.data.billToAddress ?? billing.billToAddress,
      billToEmail: (parsed.data.billToEmail && parsed.data.billToEmail !== ''
        ? parsed.data.billToEmail
        : null) ?? billing.billToEmail,
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
      company: { select: { id: true, nameEn: true, companyCode: true, companyNumber: true } },
      createdBy: { select: { nameEn: true } },
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'Invoice', invoice.id, null, invoice)
  return NextResponse.json(invoice, { status: 201 })
}
