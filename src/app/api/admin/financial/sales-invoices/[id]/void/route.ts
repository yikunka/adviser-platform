import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { voidSalesInvoice } from '@/lib/financial/sales-invoices'
import { serializeSalesInvoice } from '@/lib/financial/subledger-serializers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.salesInvoice.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('发票不存在。', 404)

  const guard = await guardFinancialMutationCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

  try {
    const invoice = await voidSalesInvoice({
      id,
      companyId: before.companyId,
      userId: guard.session.user.id,
      reason,
    })
    await logAudit(guard.session.user.id, 'VOID', 'SalesInvoice', id, null, { invoiceNo: invoice.invoiceNo, reason })
    return NextResponse.json({
      invoice: serializeSalesInvoice(invoice),
      toast: `发票 ${invoice.invoiceNo} 已作废（红冲）。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
