import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { computeReconciliationSummary } from '@/lib/financial/bank-reconciliation'

async function loadReconciliationWorkspace(id: string) {
  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: { bankAccount: { select: { id: true, companyId: true, name: true, glAccountId: true } } },
  })
  if (!reconciliation) return null

  const { bankAccount } = reconciliation

  // 该银行账户截止对账日的全部流水（按对账单），与其匹配状态
  const statementLines = await prisma.bankStatementLine.findMany({
    where: {
      statement: { bankAccountId: bankAccount.id },
      date: { lte: reconciliation.statementDate },
    },
    include: {
      matchedLedger: { select: { id: true, voucherNo: true, date: true, debit: true, credit: true, description: true } },
    },
    orderBy: [{ date: 'asc' }, { lineNum: 'asc' }],
  })

  // 银行 GL 科目截止对账日的总账行，标记是否已被任一流水匹配
  const matchedLedgerIds = new Set(
    statementLines.filter(line => line.matchedLedgerId).map(line => line.matchedLedgerId!),
  )
  const ledgerRows = await prisma.ledger.findMany({
    where: {
      accountId: bankAccount.glAccountId,
      companyId: bankAccount.companyId,
      date: { lte: reconciliation.statementDate },
    },
    orderBy: [{ date: 'asc' }, { lineNum: 'asc' }],
    select: { id: true, date: true, voucherNo: true, description: true, debit: true, credit: true },
  })

  const unmatchedStatement = statementLines.filter(line => line.status === 'UNMATCHED')
  const unmatchedLedger = ledgerRows.filter(row => !matchedLedgerIds.has(row.id))

  const summary = computeReconciliationSummary({
    statementBalance: Number(reconciliation.statementBalance),
    glBalance: Number(reconciliation.glBalance),
    unmatchedStatementAmounts: unmatchedStatement.map(line => Number(line.amount)),
    unmatchedLedgerSignedAmounts: unmatchedLedger.map(row => Number(row.debit) - Number(row.credit)),
  })

  return {
    reconciliation: {
      id: reconciliation.id,
      bankAccount: { id: bankAccount.id, name: bankAccount.name },
      companyId: bankAccount.companyId,
      statementDate: reconciliation.statementDate.toISOString().slice(0, 10),
      status: reconciliation.status,
      notes: reconciliation.notes,
      completedAt: reconciliation.completedAt?.toISOString() ?? null,
    },
    summary,
    statementLines: statementLines.map(line => ({
      id: line.id,
      date: line.date.toISOString().slice(0, 10),
      description: line.description,
      reference: line.reference,
      amount: Number(line.amount),
      status: line.status,
      matchedLedger: line.matchedLedger
        ? {
            id: line.matchedLedger.id,
            voucherNo: line.matchedLedger.voucherNo,
            date: line.matchedLedger.date.toISOString().slice(0, 10),
            amount: Number(line.matchedLedger.debit) - Number(line.matchedLedger.credit),
            description: line.matchedLedger.description,
          }
        : null,
    })),
    unmatchedLedgerRows: unmatchedLedger.map(row => ({
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      voucherNo: row.voucherNo,
      description: row.description,
      amount: Number(row.debit) - Number(row.credit),
    })),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await loadReconciliationWorkspace(id)
  if (!workspace) return apiError('对账不存在。', 404)

  const guard = await guardFinancialCompany(workspace.reconciliation.companyId)
  if (guard.error) return guard.error

  return NextResponse.json(workspace)
}

/** 完成对账：要求调节后差额为零。 */
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await loadReconciliationWorkspace(id)
  if (!workspace) return apiError('对账不存在。', 404)

  const guard = await guardFinancialCompany(workspace.reconciliation.companyId)
  if (guard.error) return guard.error

  if (workspace.reconciliation.status === 'COMPLETED') return apiError('对账已完成。')
  if (!workspace.summary.isBalanced) {
    return apiError(`调节后仍有差额 ${workspace.summary.unexplainedDifference}，请先匹配或排除流水。`)
  }

  try {
    await prisma.bankReconciliation.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    await logAudit(guard.session.user.id, 'UPDATE', 'BankReconciliation', id, null, { status: 'COMPLETED' })
    return NextResponse.json({ toast: '对账已完成。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}
