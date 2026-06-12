import { Prisma } from '@prisma/client'
import type { AccountType } from '@prisma/client'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

function periodFromEntryDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export type LedgerEntryHeader = {
  id: string
  companyId: string
  entryDate: Date
  voucherNo: string
  description: string
}

export type LedgerLineInput = {
  accountId: string
  lineNum: number
  description: string
  debit: Prisma.Decimal | number
  credit: Prisma.Decimal | number
  account: { type: AccountType; code: string }
}

/**
 * 把一张已过账凭证的分录写入总分类账（含逐行余额）。
 * 余额承接顺序：同科目上一条 Ledger 行 → AccountBalance 期初。
 * 所有过账路径（手工凭证 / 子分类账自动凭证 / 红冲）共用此函数。
 * 必须在事务内调用。
 */
export async function writeLedgerRows(
  tx: Prisma.TransactionClient,
  entry: LedgerEntryHeader,
  lines: LedgerLineInput[],
) {
  const sortedLines = lines.slice().sort((a, b) => a.lineNum - b.lineNum)
  const balances = new Map<string, number>()

  for (const line of sortedLines) {
    if (!balances.has(line.accountId)) {
      const previous = await tx.ledger.findFirst({
        where: {
          accountId: line.accountId,
          companyId: entry.companyId,
          OR: [
            { date: { lt: entry.entryDate } },
            { date: entry.entryDate, lineNum: { lt: line.lineNum } },
          ],
        },
        orderBy: [{ date: 'desc' }, { lineNum: 'desc' }],
        select: { balance: true },
      })
      if (previous) {
        balances.set(line.accountId, Number(previous.balance))
      } else {
        const opening = await tx.accountBalance.findFirst({
          where: {
            accountId: line.accountId,
            period: { lte: periodFromEntryDate(entry.entryDate) },
          },
          orderBy: { period: 'desc' },
          select: { openingDebit: true, openingCredit: true },
        })
        balances.set(
          line.accountId,
          opening
            ? signedLineAmount({
                accountId: line.accountId,
                accountType: line.account.type,
                accountCode: line.account.code,
                debit: opening.openingDebit,
                credit: opening.openingCredit,
              })
            : 0,
        )
      }
    }

    const nextBalance = roundMoney(
      (balances.get(line.accountId) ?? 0) +
        signedLineAmount({
          accountId: line.accountId,
          accountType: line.account.type,
          accountCode: line.account.code,
          debit: line.debit,
          credit: line.credit,
        }),
    )
    balances.set(line.accountId, nextBalance)

    await tx.ledger.create({
      data: {
        accountId: line.accountId,
        entryId: entry.id,
        companyId: entry.companyId,
        lineNum: line.lineNum,
        date: entry.entryDate,
        voucherNo: entry.voucherNo,
        description: line.description || entry.description,
        debit: new Prisma.Decimal(line.debit),
        credit: new Prisma.Decimal(line.credit),
        balance: new Prisma.Decimal(nextBalance),
      },
    })
  }
}
