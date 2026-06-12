import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import { requireRole } from '@/lib/auth/rbac'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { MappingNotFoundError } from '@/lib/financial/account-mappings'
import { PeriodClosedError } from '@/lib/financial/fiscal-periods'
import { PostingError } from '@/lib/financial/posting-engine'

export function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

/**
 * 财务子分类账路由公共守卫：STAFF 角色 + financial 菜单 + 公司访问范围。
 * 返回 { session } 或 { error }（直接 return 给路由）。
 */
export async function guardFinancialCompany(
  companyId: string | null | undefined,
): Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return { error }
  if (!companyId) return { error: apiError('companyId is required') }
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) {
    return { error: apiError('Forbidden', 403) }
  }
  return { session: session! }
}

/** 业务错误 → 400（带中文 toast）；唯一键冲突 → 409；其余抛给全局。 */
export function handleFinancialError(err: unknown): NextResponse {
  if (err instanceof PostingError || err instanceof PeriodClosedError || err instanceof MappingNotFoundError) {
    return apiError(err.message)
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return apiError('编号冲突，请重试。', 409)
  }
  throw err
}
