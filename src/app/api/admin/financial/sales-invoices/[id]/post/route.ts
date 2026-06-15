import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { postSalesInvoice } from '@/lib/financial/sales-invoices'
import { serializeSalesInvoice } from '@/lib/financial/subledger-serializers'

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.salesInvoice.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('发票不存在。', 404)

  const guard = await guardFinancialMutationCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    const invoice = await postSalesInvoice({ id, companyId: before.companyId, userId: guard.session.user.id })
    await logAudit(guard.session.user.id, 'POST', 'SalesInvoice', id, null, {
      invoiceNo: invoice.invoiceNo,
      journalEntryId: invoice.journalEntryId,
    })
    return NextResponse.json({
      invoice: serializeSalesInvoice(invoice),
      toast: `发票 ${invoice.invoiceNo} 已开票并自动过账。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
