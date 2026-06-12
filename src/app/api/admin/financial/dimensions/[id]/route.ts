import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { dimensionDelegate, dimensionInUse, isDimensionType, serializeDimension } from '@/lib/financial/dimensions'
import { dimensionUpdateSchema } from '@/lib/financial/schemas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const type = req.nextUrl.searchParams.get('type')
  if (!isDimensionType(type)) return apiError('维度类型无效。')

  const delegate = dimensionDelegate(type)
  const before = await delegate.findUnique({ where: { id } })
  if (!before) return apiError('维度不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId)
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = dimensionUpdateSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || '请检查维度表单。')

  try {
    const row = await delegate.update({ where: { id }, data: parsed.data })
    await logAudit(guard.session.user.id, 'UPDATE', type === 'cost-center' ? 'CostCenter' : 'FinProject', id, before, row)
    return NextResponse.json({ dimension: serializeDimension(row), toast: '已更新。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const type = req.nextUrl.searchParams.get('type')
  if (!isDimensionType(type)) return apiError('维度类型无效。')

  const delegate = dimensionDelegate(type)
  const before = await delegate.findUnique({ where: { id } })
  if (!before) return apiError('维度不存在。', 404)

  const guard = await guardFinancialCompany(before.companyId)
  if (guard.error) return guard.error

  try {
    // 已被凭证引用时停用而非删除，保留历史归集
    if (await dimensionInUse(type, id)) {
      const row = await delegate.update({ where: { id }, data: { isActive: false } })
      await logAudit(guard.session.user.id, 'UPDATE', type === 'cost-center' ? 'CostCenter' : 'FinProject', id, before, row)
      return NextResponse.json({ dimension: serializeDimension(row), toast: '该维度已有凭证引用，已停用（未删除）。' })
    }
    await delegate.delete({ where: { id } })
    await logAudit(guard.session.user.id, 'DELETE', type === 'cost-center' ? 'CostCenter' : 'FinProject', id, before, null)
    return NextResponse.json({ toast: '已删除。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}
