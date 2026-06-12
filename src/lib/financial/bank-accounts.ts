import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { PostingError } from '@/lib/financial/posting-engine'
import { roundMoney, signedLineAmount } from '@/lib/financial/utils'

/**
 * 银行 GL 科目在某日的总账余额：
 * 取该科目 ≤ asOf 的最后一条 Ledger 行的滚动余额；
 * 没有过账记录时退回 AccountBalance 期初。
 */
export async function bankGlBalanceAsOf(args: { companyId: string; glAccountId: string; asOf: Date }) {
  const lastRow = await prisma.ledger.findFirst({
    where: {
      accountId: args.glAccountId,
      companyId: args.companyId,
      date: { lte: args.asOf },
    },
    orderBy: [{ date: 'desc' }, { lineNum: 'desc' }],
    select: { balance: true },
  })
  if (lastRow) return roundMoney(Number(lastRow.balance))

  const period = `${args.asOf.getUTCFullYear()}-${String(args.asOf.getUTCMonth() + 1).padStart(2, '0')}`
  const opening = await prisma.accountBalance.findFirst({
    where: { accountId: args.glAccountId, period: { lte: period } },
    orderBy: { period: 'desc' },
    select: { openingDebit: true, openingCredit: true },
  })
  if (!opening) return 0
  const account = await prisma.finAccount.findUnique({
    where: { id: args.glAccountId },
    select: { type: true, code: true },
  })
  return roundMoney(
    signedLineAmount({
      accountId: args.glAccountId,
      accountType: account?.type,
      accountCode: account?.code,
      debit: opening.openingDebit,
      credit: opening.openingCredit,
    }),
  )
}

export type ImportStatementLineInput = {
  date: Date
  description: string
  reference: string
  amount: number
}

/** 导入银行对账单（一次导入一个文件的流水）。 */
export async function importBankStatement(args: {
  bankAccountId: string
  companyId: string
  fileName: string
  openingBalance?: number | null
  closingBalance?: number | null
  importedById: string
  lines: ImportStatementLineInput[]
}) {
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: args.bankAccountId },
    select: { companyId: true },
  })
  if (!bankAccount || bankAccount.companyId !== args.companyId) throw new PostingError('银行账户不存在。')
  if (args.lines.length === 0) throw new PostingError('对账单至少需要一行流水。')

  const dates = args.lines.map(line => line.date.getTime())
  return prisma.bankStatement.create({
    data: {
      bankAccountId: args.bankAccountId,
      fileName: args.fileName,
      periodStart: new Date(Math.min(...dates)),
      periodEnd: new Date(Math.max(...dates)),
      openingBalance: args.openingBalance == null ? null : new Prisma.Decimal(args.openingBalance),
      closingBalance: args.closingBalance == null ? null : new Prisma.Decimal(args.closingBalance),
      importedById: args.importedById,
      lines: {
        create: args.lines.map((line, index) => ({
          lineNum: index + 1,
          date: line.date,
          description: line.description,
          reference: line.reference,
          amount: new Prisma.Decimal(roundMoney(line.amount)),
        })),
      },
    },
    include: { lines: { orderBy: { lineNum: 'asc' } } },
  })
}
