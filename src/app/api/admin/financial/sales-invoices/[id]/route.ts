import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import {
  deleteDraftSalesInvoice,
  salesInvoiceInclude,
  updateDraftSalesInvoice,
} from '@/lib/financial/sales-invoices'
import { salesInvoiceCreateSchema } from '@/lib/financial/schemas'
import { serializeSalesInvoice } from '@/lib/financial/subledger-serializers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.salesInvoice.findUnique({ where: { id }, include: salesInvoiceInclude })
  if (!invoice) return apiError('发票不存在。', 404)

  const guard = await guardFinancialCompany(invoice.companyId, { requireManager: true })
  if (guard.error) return guard.error

  return NextResponse.json({ invoice: serializeSalesInvoice(invoice) })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.salesInvoice.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('发票不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = salesInvoiceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查发票表单。')
  }

  try {
    const invoice = await updateDraftSalesInvoice({ ...parsed.data, id })
    await logAudit(guard.session.user.id, 'UPDATE', 'SalesInvoice', id, null, { invoiceNo: invoice.invoiceNo })
    return NextResponse.json({ invoice: serializeSalesInvoice(invoice), toast: '发票已更新。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.salesInvoice.findUnique({ where: { id }, select: { companyId: true, invoiceNo: true } })
  if (!before) return apiError('发票不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    await deleteDraftSalesInvoice(id, before.companyId)
    await logAudit(guard.session.user.id, 'DELETE', 'SalesInvoice', id, before, null)
    return NextResponse.json({ toast: `发票 ${before.invoiceNo} 已删除。` })
  } catch (err) {
    return handleFinancialError(err)
  }
}
