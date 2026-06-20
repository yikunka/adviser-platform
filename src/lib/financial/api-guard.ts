import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'
import { prisma } from '@/lib/db/prisma'
import { MappingNotFoundError } from '@/lib/financial/account-mappings'
import { PeriodClosedError } from '@/lib/financial/fiscal-periods'
import { PartyAccountError } from '@/lib/financial/party-accounts'
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
  options?: { requireManager?: boolean },
): Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return { error }
  if (!companyId) return { error: apiError('companyId is required') }
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) {
    return { error: apiError('Forbidden', 403) }
  }
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { financialEnabled: true, financialManagerId: true },
  })
  if (!company) return { error: apiError('Company not found', 404) }
  if (!company.financialEnabled) return { error: apiError('Financial module is not enabled for this company.', 403) }
  if (
    options?.requireManager
    && session!.user.role !== 'SUPER_ADMIN'
    && session!.user.role !== 'STAFF'
    && company.financialManagerId !== session!.user.id
  ) {
    return { error: apiError('Only the assigned financial manager can perform financial operations for this company.', 403) }
  }
  return { session: session! }
}

export function assertFinancialWriteAllowed(session: Session): NextResponse | null {
  if (session.user.role === 'STAFF') {
    return apiError('Staff 角色在财务模块仅可查看和导出，不能修改任何财务数据。', 403)
  }
  return null
}

export async function requireFinancialReadRole():
Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return { error }
  return { session: session! }
}

export async function requireFinancialWriteRole(permission?: string):
Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return { error }
  if (permission) {
    const permissionResult = await requirePermission(permission, 'STAFF')
    if (permissionResult.error) return { error: permissionResult.error }
    return { session: permissionResult.session! }
  }
  const writeError = assertFinancialWriteAllowed(session!)
  if (writeError) return { error: writeError }
  return { session: session! }
}

export async function guardFinancialMutationCompany(
  companyId: string | null | undefined,
  options?: { requireManager?: boolean },
): Promise<{ session: Session; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const guard = await guardFinancialCompany(companyId, options)
  if (guard.error) return guard
  const writeError = assertFinancialWriteAllowed(guard.session)
  if (writeError) return { error: writeError }
  return guard
}

export async function assertFinancialManager(
  session: Session,
  companyId: string | null | undefined,
): Promise<NextResponse | null> {
  if (!companyId) return apiError('companyId is required')
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { financialEnabled: true, financialManagerId: true },
  })
  if (!company) return apiError('Company not found', 404)
  if (!company.financialEnabled) return apiError('Financial module is not enabled for this company.', 403)
  if (session.user.role !== 'SUPER_ADMIN' && company.financialManagerId !== session.user.id) {
    return apiError('Only the assigned financial manager can perform financial operations for this company.', 403)
  }
  return null
}

/** 业务错误 → 400（带中文 toast）；唯一键冲突 → 409；其余抛给全局。 */
export function handleFinancialError(err: unknown): NextResponse {
  if (err instanceof PostingError || err instanceof PeriodClosedError || err instanceof MappingNotFoundError || err instanceof PartyAccountError) {
    return apiError(err.message)
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return apiError('编号冲突，请重试。', 409)
  }
  throw err
}
