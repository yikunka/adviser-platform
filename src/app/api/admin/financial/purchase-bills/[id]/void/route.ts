import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { voidPurchaseBill } from '@/lib/financial/purchase-bills'
import { serializePurchaseBill } from '@/lib/financial/subledger-serializers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.purchaseBill.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('账单不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

  try {
    const bill = await voidPurchaseBill({
      id,
      companyId: before.companyId,
      userId: guard.session.user.id,
      reason,
    })
    await logAudit(guard.session.user.id, 'VOID', 'PurchaseBill', id, null, { billNo: bill.billNo, reason })
    return NextResponse.json({
      bill: serializePurchaseBill(bill),
      toast: `账单 ${bill.billNo} 已作废（红冲）。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
