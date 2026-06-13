import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { postPurchaseBill } from '@/lib/financial/purchase-bills'
import { serializePurchaseBill } from '@/lib/financial/subledger-serializers'

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.purchaseBill.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('账单不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    const bill = await postPurchaseBill({ id, companyId: before.companyId, userId: guard.session.user.id })
    await logAudit(guard.session.user.id, 'POST', 'PurchaseBill', id, null, {
      billNo: bill.billNo,
      journalEntryId: bill.journalEntryId,
    })
    return NextResponse.json({
      bill: serializePurchaseBill(bill),
      toast: `账单 ${bill.billNo} 已入账并自动过账。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
