import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import {
  deleteDraftPurchaseBill,
  purchaseBillInclude,
  updateDraftPurchaseBill,
} from '@/lib/financial/purchase-bills'
import { purchaseBillCreateSchema } from '@/lib/financial/schemas'
import { serializePurchaseBill } from '@/lib/financial/subledger-serializers'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bill = await prisma.purchaseBill.findUnique({ where: { id }, include: purchaseBillInclude })
  if (!bill) return apiError('账单不存在。', 404)

  const guard = await guardFinancialCompany(bill.companyId, { requireManager: true })
  if (guard.error) return guard.error

  return NextResponse.json({ bill: serializePurchaseBill(bill) })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.purchaseBill.findUnique({ where: { id }, select: { companyId: true } })
  if (!before) return apiError('账单不存在。', 404)

  const guard = await guardFinancialMutationCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = purchaseBillCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查账单表单。')
  }

  try {
    const bill = await updateDraftPurchaseBill({ ...parsed.data, id })
    await logAudit(guard.session.user.id, 'UPDATE', 'PurchaseBill', id, null, { billNo: bill.billNo })
    return NextResponse.json({ bill: serializePurchaseBill(bill), toast: '账单已更新。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await prisma.purchaseBill.findUnique({ where: { id }, select: { companyId: true, billNo: true } })
  if (!before) return apiError('账单不存在。', 404)

  const guard = await guardFinancialMutationCompany(before.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    await deleteDraftPurchaseBill(id, before.companyId)
    await logAudit(guard.session.user.id, 'DELETE', 'PurchaseBill', id, before, null)
    return NextResponse.json({ toast: `账单 ${before.billNo} 已删除。` })
  } catch (err) {
    return handleFinancialError(err)
  }
}
