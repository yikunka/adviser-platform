import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { bankGlBalanceAsOf } from '@/lib/financial/bank-accounts'
import { reconciliationCreateSchema } from '@/lib/financial/schemas'
import { parseYmdDate } from '@/lib/financial/utils'

export async function GET(req: NextRequest) {
  const bankAccountId = req.nextUrl.searchParams.get('bankAccountId')
  if (!bankAccountId) return apiError('bankAccountId is required')

  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { companyId: true },
  })
  if (!bankAccount) return apiError('银行账户不存在。', 404)

  const guard = await guardFinancialCompany(bankAccount.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const reconciliations = await prisma.bankReconciliation.findMany({
    where: { bankAccountId },
    include: { createdBy: { select: { nameEn: true } }, _count: { select: { statementLines: true } } },
    orderBy: { statementDate: 'desc' },
  })

  return NextResponse.json({
    reconciliations: reconciliations.map(reconciliation => ({
      id: reconciliation.id,
      statementDate: reconciliation.statementDate.toISOString().slice(0, 10),
      statementBalance: Number(reconciliation.statementBalance),
      glBalance: Number(reconciliation.glBalance),
      status: reconciliation.status,
      notes: reconciliation.notes,
      createdBy: reconciliation.createdBy?.nameEn ?? null,
      completedAt: reconciliation.completedAt?.toISOString() ?? null,
      createdAt: reconciliation.createdAt.toISOString(),
      matchedLines: reconciliation._count.statementLines,
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = reconciliationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查对账输入。')
  }

  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: parsed.data.bankAccountId },
    select: { companyId: true, glAccountId: true, name: true },
  })
  if (!bankAccount) return apiError('银行账户不存在。', 404)

  const guard = await guardFinancialMutationCompany(bankAccount.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const inProgress = await prisma.bankReconciliation.findFirst({
    where: { bankAccountId: parsed.data.bankAccountId, status: 'IN_PROGRESS' },
    select: { id: true },
  })
  if (inProgress) return apiError('该银行账户已有进行中的对账，请先完成或继续该对账。')

  const statementDate = parseYmdDate(parsed.data.statementDate)
  const glBalance = await bankGlBalanceAsOf({
    companyId: bankAccount.companyId,
    glAccountId: bankAccount.glAccountId,
    asOf: statementDate,
  })

  try {
    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        bankAccountId: parsed.data.bankAccountId,
        statementDate,
        statementBalance: new Prisma.Decimal(parsed.data.statementBalance),
        glBalance: new Prisma.Decimal(glBalance),
        notes: parsed.data.notes,
        createdById: guard.session.user.id,
      },
    })
    await logAudit(guard.session.user.id, 'CREATE', 'BankReconciliation', reconciliation.id, null, {
      bankAccount: bankAccount.name,
      statementDate: parsed.data.statementDate,
    })
    return NextResponse.json({ reconciliationId: reconciliation.id, toast: '对账已创建。' }, { status: 201 })
  } catch (err) {
    return handleFinancialError(err)
  }
}
