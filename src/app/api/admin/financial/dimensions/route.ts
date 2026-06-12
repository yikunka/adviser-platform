import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { dimensionDelegate, isDimensionType, serializeDimension } from '@/lib/financial/dimensions'
import { dimensionCreateSchema } from '@/lib/financial/schemas'

/** 维度主数据：成本中心 / 项目（?type=cost-center|project） */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  if (!isDimensionType(type)) return apiError('维度类型无效。')
  const companyId = req.nextUrl.searchParams.get('companyId')
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === '1'
  const rows = await dimensionDelegate(type).findMany({
    where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { code: 'asc' },
  })
  return NextResponse.json({ dimensions: rows.map(serializeDimension) })
}

export async function POST(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  if (!isDimensionType(type)) return apiError('维度类型无效。')

  const body = await req.json().catch(() => null)
  const parsed = dimensionCreateSchema.safeParse(body)
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || '请检查维度表单。')

  const guard = await guardFinancialCompany(parsed.data.companyId)
  if (guard.error) return guard.error

  try {
    const row = await dimensionDelegate(type).create({
      data: {
        companyId: parsed.data.companyId,
        code: parsed.data.code,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
    })
    await logAudit(guard.session.user.id, 'CREATE', type === 'cost-center' ? 'CostCenter' : 'FinProject', row.id, null, row)
    return NextResponse.json({ dimension: serializeDimension(row), toast: '已创建。' }, { status: 201 })
  } catch (err) {
    return handleFinancialError(err)
  }
}
