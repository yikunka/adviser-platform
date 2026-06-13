import { NextRequest, NextResponse } from 'next/server'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { autoMatchStatementLines } from '@/lib/financial/bank-reconciliation'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: { bankAccount: { select: { id: true, companyId: true, glAccountId: true } } },
  })
  if (!reconciliation) return apiError('对账不存在。', 404)
  if (reconciliation.status === 'COMPLETED') return apiError('对账已完成，不能再匹配。')

  const guard = await guardFinancialCompany(reconciliation.bankAccount.companyId, { requireManager: true })
  if (guard.error) return guard.error

  const [unmatchedLines, matchedIds] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where: {
        statement: { bankAccountId: reconciliation.bankAccount.id },
        date: { lte: reconciliation.statementDate },
        status: 'UNMATCHED',
      },
      select: { id: true, date: true, amount: true, reference: true, description: true },
    }),
    prisma.bankStatementLine.findMany({
      where: { statement: { bankAccountId: reconciliation.bankAccount.id }, matchedLedgerId: { not: null } },
      select: { matchedLedgerId: true },
    }),
  ])

  const usedLedgerIds = new Set(matchedIds.map(row => row.matchedLedgerId!))
  const ledgerRows = await prisma.ledger.findMany({
    where: {
      accountId: reconciliation.bankAccount.glAccountId,
      companyId: reconciliation.bankAccount.companyId,
      date: { lte: reconciliation.statementDate },
      ...(usedLedgerIds.size > 0 ? { id: { notIn: [...usedLedgerIds] } } : {}),
    },
    select: { id: true, date: true, debit: true, credit: true, voucherNo: true, description: true },
  })

  const result = autoMatchStatementLines(
    unmatchedLines.map(line => ({
      id: line.id,
      date: line.date,
      amount: Number(line.amount),
      reference: line.reference,
      description: line.description,
    })),
    ledgerRows.map(row => ({
      id: row.id,
      date: row.date,
      debit: Number(row.debit),
      credit: Number(row.credit),
      voucherNo: row.voucherNo,
      description: row.description,
    })),
  )

  try {
    await prisma.$transaction(
      result.matches.map(match =>
        prisma.bankStatementLine.update({
          where: { id: match.statementLineId },
          data: { status: 'MATCHED', matchedLedgerId: match.ledgerId, reconciliationId: id },
        }),
      ),
    )
    await logAudit(guard.session.user.id, 'UPDATE', 'BankReconciliation', id, null, {
      autoMatched: result.matches.length,
    })
    return NextResponse.json({
      matched: result.matches.length,
      unmatched: result.unmatchedStatementLineIds.length,
      toast: `自动匹配完成：成功 ${result.matches.length} 条，剩余 ${result.unmatchedStatementLineIds.length} 条未匹配。`,
    })
  } catch (err) {
    return handleFinancialError(err)
  }
}
