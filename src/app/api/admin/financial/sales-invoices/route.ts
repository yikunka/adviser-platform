import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { createSalesInvoice, salesInvoiceInclude } from '@/lib/financial/sales-invoices'
import { salesInvoiceCreateSchema } from '@/lib/financial/schemas'
import { serializeSalesInvoice } from '@/lib/financial/subledger-serializers'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const status = req.nextUrl.searchParams.get('status')
  const partyId = req.nextUrl.searchParams.get('partyId')
  const search = req.nextUrl.searchParams.get('search')?.trim()
  const openOnly = req.nextUrl.searchParams.get('openOnly') === '1'

  const where: Prisma.SalesInvoiceWhereInput = {
    companyId: companyId!,
    ...(status ? { status: status as Prisma.SalesInvoiceWhereInput['status'] } : {}),
    ...(openOnly ? { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } } : {}),
    ...(partyId ? { partyId } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNo: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
            { party: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const invoices = await prisma.salesInvoice.findMany({
    where,
    include: salesInvoiceInclude,
    orderBy: [{ issueDate: 'desc' }, { invoiceNo: 'desc' }],
  })
  return NextResponse.json({ invoices: invoices.map(serializeSalesInvoice) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = salesInvoiceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查发票表单。')
  }

  const guard = await guardFinancialCompany(parsed.data.companyId)
  if (guard.error) return guard.error

  try {
    const invoice = await createSalesInvoice({
      ...parsed.data,
      createdById: guard.session.user.id,
    })
    await logAudit(guard.session.user.id, 'CREATE', 'SalesInvoice', invoice.id, null, { invoiceNo: invoice.invoiceNo })
    return NextResponse.json(
      { invoice: serializeSalesInvoice(invoice), toast: `发票 ${invoice.invoiceNo} 已创建（草稿）。` },
      { status: 201 },
    )
  } catch (err) {
    return handleFinancialError(err)
  }
}
