import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  assertCompanyAccessible,
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { companyBillingSnapshot, keyPersonBillingSnapshot } from '@/lib/invoice/company-billing'
import { computeTotals, toMoney, toQuantity, toTaxRate } from '@/lib/invoice/calc'
import { nextInvoiceNumber } from '@/lib/invoice/number'
import { z } from 'zod'

const INVOICE_CREATE_MAX_ATTEMPTS = 3

const lineSchema = z.object({
  tcspServicePriceId: z.string().cuid().optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999999),
  unitPrice: z.number().min(0).max(999999999),
  discountType: z.enum(['PERCENT', 'FIXED']).optional().nullable(),
  discountValue: z.number().min(0).max(999999999).optional().nullable(),
})

const createSchema = z.object({
  customerType: z.enum(['COMPANY', 'INDIVIDUAL']).default('COMPANY'),
  companyId: z.string().cuid().optional().nullable(),
  keyPersonId: z.string().cuid().optional().nullable(),
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

function isInvoiceNumberConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  if (error.meta?.modelName === 'Invoice') {
    return true
  }
  const target = error.meta?.target
  return Array.isArray(target) ? target.includes('invoiceNumber') : target === 'invoiceNumber'
}

async function assertTcspServicePricesExist(ids: Array<string | null | undefined>) {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
  if (uniqueIds.length === 0) return true

  const count = await prisma.tcspServicePrice.count({ where: { id: { in: uniqueIds } } })
  return count === uniqueIds.length
}

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

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (companyId && !(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const companyFilter = buildCompanyAccessWhere(access)
  const where: Prisma.InvoiceWhereInput = {
    AND: [
      ...(companyFilter
        ? [{ OR: [{ company: companyFilter }, { customerType: 'INDIVIDUAL' }] } satisfies Prisma.InvoiceWhereInput]
        : []),
      ...(companyId ? [{ companyId }] : []),
      ...(status ? [{ status: status as 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' }] : []),
      ...(search
        ? [{
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' as const } },
              { billToName: { contains: search, mode: 'insensitive' as const } },
              { company: { nameEn: { contains: search, mode: 'insensitive' as const } } },
              { keyPerson: { nameEn: { contains: search, mode: 'insensitive' as const } } },
              { keyPerson: { kycCode: { contains: search, mode: 'insensitive' as const } } },
            ],
          } satisfies Prisma.InvoiceWhereInput]
        : []),
    ],
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { issueDate: 'desc' },
      include: {
        company: { select: { id: true, nameEn: true, companyCode: true } },
        keyPerson: { select: { id: true, nameEn: true, kycCode: true } },
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

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const customerType = parsed.data.customerType
  const companyId = customerType === 'COMPANY' ? parsed.data.companyId : null
  const keyPersonId = customerType === 'INDIVIDUAL' ? parsed.data.keyPersonId : null
  if (customerType === 'COMPANY' && !companyId) {
    return NextResponse.json({ error: 'Company is required' }, { status: 400 })
  }
  if (customerType === 'INDIVIDUAL' && !keyPersonId) {
    return NextResponse.json({ error: 'KYC person is required' }, { status: 400 })
  }

  if (companyId && !(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!(await assertTcspServicePricesExist(parsed.data.lineItems.map(line => line.tcspServicePriceId)))) {
    return NextResponse.json({ error: 'Invalid TCSP service price selection' }, { status: 400 })
  }

  const billing = companyId
    ? await companyBillingSnapshot(companyId)
    : await keyPersonBillingSnapshot(keyPersonId!)
  if (!billing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const issueDate = new Date(parsed.data.issueDate)
  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
  const { subtotal, taxAmount, total, lineAmounts } = computeTotals(
    parsed.data.lineItems,
    parsed.data.taxRate,
  )

  let invoice: Awaited<ReturnType<typeof prisma.invoice.create>> | null = null
  for (let attempt = 1; attempt <= INVOICE_CREATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      invoice = await prisma.$transaction(async tx => {
        const invoiceNumber = await nextInvoiceNumber(issueDate, tx, { lockSequence: true })

        return tx.invoice.create({
          data: {
            invoiceNumber,
            customerType,
            companyId,
            keyPersonId,
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
                tcspServicePriceId: line.tcspServicePriceId ?? null,
                description: line.description,
                quantity: toQuantity(line.quantity),
                unitPrice: toMoney(line.unitPrice),
                discountType: line.discountType ?? null,
                discountValue: line.discountType ? toQuantity(line.discountValue ?? 0) : null,
                amount: toMoney(lineAmounts[i]!),
              })),
            },
          },
          include: {
            lineItems: { orderBy: { sortOrder: 'asc' } },
            company: { select: { id: true, nameEn: true, companyCode: true, companyNumber: true } },
            keyPerson: { select: { id: true, nameEn: true, kycCode: true, idType: true, idNumber: true } },
            createdBy: { select: { nameEn: true } },
          },
        })
      })
      break
    } catch (err) {
      if (attempt < INVOICE_CREATE_MAX_ATTEMPTS && isInvoiceNumberConflict(err)) {
        continue
      }
      throw err
    }
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Failed to create invoice number' }, { status: 409 })
  }

  await logAudit(session!.user.id, 'CREATE', 'Invoice', invoice.id, null, invoice)
  return NextResponse.json(invoice, { status: 201 })
}
