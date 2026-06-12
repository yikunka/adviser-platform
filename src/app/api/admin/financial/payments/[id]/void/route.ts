import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { voidPayment } from '@/lib/financial/fin-payments'
import { serializePayment } from '@/lib/financial/subledger-serializers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.finPayment.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('收付款单不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId)
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

  try {
    const payment = await voidPayment({
      id,
      companyId: before.companyId,
      userId: guard.session.user.id,
      reason,
    })
    await logAudit(guard.session.user.id, 'VOID', 'FinPayment', id, null, { paymentNo: payment.paymentNo, reason })
    return NextResponse.json({
      payment: serializePayment(payment),
      toast: `${payment.direction === 'RECEIPT' ? '收款' : '付款'} ${payment.paymentNo} 已作废，核销已回滚。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
