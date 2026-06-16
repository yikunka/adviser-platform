import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, guardFinancialMutationCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { importBankStatement } from '@/lib/financial/bank-accounts'
import { bankStatementImportSchema } from '@/lib/financial/schemas'
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

  const statements = await prisma.bankStatement.findMany({
    where: { bankAccountId },
    include: {
      importedBy: { select: { nameEn: true } },
      _count: { select: { lines: true } },
      lines: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    statements: statements.map(statement => ({
      id: statement.id,
      fileName: statement.fileName,
      periodStart: statement.periodStart?.toISOString().slice(0, 10) ?? null,
      periodEnd: statement.periodEnd?.toISOString().slice(0, 10) ?? null,
      openingBalance: statement.openingBalance === null ? null : Number(statement.openingBalance),
      closingBalance: statement.closingBalance === null ? null : Number(statement.closingBalance),
      importedBy: statement.importedBy?.nameEn ?? null,
      createdAt: statement.createdAt.toISOString(),
      lineCount: statement._count.lines,
      matchedCount: statement.lines.filter(line => line.status === 'MATCHED').length,
      unmatchedCount: statement.lines.filter(line => line.status === 'UNMATCHED').length,
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = bankStatementImportSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '请检查对账单导入数据。')
  }

  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: parsed.data.bankAccountId },
    select: { companyId: true, name: true },
  })
  if (!bankAccount) return apiError('银行账户不存在。', 404)

  const guard = await guardFinancialMutationCompany(bankAccount.companyId, { requireManager: true })
  if (guard.error) return guard.error

  try {
    const statement = await importBankStatement({
      bankAccountId: parsed.data.bankAccountId,
      companyId: bankAccount.companyId,
      fileName: parsed.data.fileName,
      openingBalance: parsed.data.openingBalance,
      closingBalance: parsed.data.closingBalance,
      importedById: guard.session.user.id,
      lines: parsed.data.lines.map(line => ({
        date: parseYmdDate(line.date),
        description: line.description,
        reference: line.reference,
        amount: line.amount,
      })),
    })
    await logAudit(guard.session.user.id, 'CREATE', 'BankStatement', statement.id, null, {
      bankAccount: bankAccount.name,
      lines: statement.lines.length,
    })
    return NextResponse.json(
      { statementId: statement.id, imported: statement.lines.length, toast: `已导入 ${statement.lines.length} 行银行流水。` },
      { status: 201 },
    )
  } catch (err) {
    return handleFinancialError(err)
  }
}
