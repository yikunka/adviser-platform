import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import { apiError, guardFinancialCompany, handleFinancialError } from '@/lib/financial/api-guard'
import { roundMoney } from '@/lib/financial/utils'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('MATCH'), ledgerId: z.string().min(1), reconciliationId: z.string().min(1).optional() }),
  z.object({ action: z.literal('UNMATCH') }),
  z.object({ action: z.literal('EXCLUDE') }),
  z.object({ action: z.literal('INCLUDE') }),
])

/** 手动匹配 / 取消匹配 / 排除流水行。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const line = await prisma.bankStatementLine.findUnique({
    where: { id },
    include: { statement: { include: { bankAccount: { select: { companyId: true, glAccountId: true } } } } },
  })
  if (!line) return apiError('流水行不存在。', 404)

  const companyId = line.statement.bankAccount.companyId
  const guard = await guardFinancialCompany(companyId)
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return apiError('无效的操作。')

  try {
    if (parsed.data.action === 'MATCH') {
      const ledgerRow = await prisma.ledger.findUnique({
        where: { id: parsed.data.ledgerId },
        select: { id: true, accountId: true, companyId: true, debit: true, credit: true },
      })
      if (
        !ledgerRow
        || ledgerRow.companyId !== companyId
        || ledgerRow.accountId !== line.statement.bankAccount.glAccountId
      ) {
        return apiError('总账行不存在或不属于该银行科目。')
      }
      const taken = await prisma.bankStatementLine.findFirst({
        where: { matchedLedgerId: parsed.data.ledgerId, id: { not: id } },
        select: { id: true },
      })
      if (taken) return apiError('该总账行已被其他流水匹配。')
      const ledgerAmount = roundMoney(Number(ledgerRow.debit) - Number(ledgerRow.credit))
      if (ledgerAmount !== roundMoney(Number(line.amount))) {
        return apiError(`金额不一致：流水 ${Number(line.amount)}，总账 ${ledgerAmount}。`)
      }
      await prisma.bankStatementLine.update({
        where: { id },
        data: {
          status: 'MATCHED',
          matchedLedgerId: parsed.data.ledgerId,
          reconciliationId: parsed.data.reconciliationId ?? line.reconciliationId,
        },
      })
    } else if (parsed.data.action === 'UNMATCH') {
      await prisma.bankStatementLine.update({
        where: { id },
        data: { status: 'UNMATCHED', matchedLedgerId: null, reconciliationId: null },
      })
    } else {
      await prisma.bankStatementLine.update({
        where: { id },
        data:
          parsed.data.action === 'EXCLUDE'
            ? { status: 'EXCLUDED', matchedLedgerId: null }
            : { status: 'UNMATCHED' },
      })
    }

    await logAudit(guard.session.user.id, 'UPDATE', 'BankStatementLine', id, null, { action: parsed.data.action })
    return NextResponse.json({ toast: '已更新。' })
  } catch (err) {
    return handleFinancialError(err)
  }
}
