import { Prisma } from '@prisma/client'
import type { JournalSourceType } from '@prisma/client'
import { assertPeriodOpen } from '@/lib/financial/fiscal-periods'
import { writeLedgerRows } from '@/lib/financial/ledger-writer'
import { generateVoucherNo, periodFromDate, roundMoney, validateBalance } from '@/lib/financial/utils'

export class PostingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PostingError'
  }
}

export type PostingLineInput = {
  accountId: string
  description?: string
  debit: number
  credit: number
  partyId?: string | null
  costCenterId?: string | null
  projectId?: string | null
  notes?: string
}

export type PostEntryInput = {
  companyId: string
  entryDate: Date
  description: string
  sourceType: JournalSourceType
  sourceId?: string | null
  createdById?: string | null
  attachments?: string[]
  lines: PostingLineInput[]
}

const postedEntryInclude = {
  lines: {
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: { lineNum: 'asc' as const },
  },
} satisfies Prisma.JournalEntryInclude

export type PostedEntry = Prisma.JournalEntryGetPayload<{ include: typeof postedEntryInclude }>

/** 借贷必平、行必有借或贷（不可同有/同无）、合计大于零。 */
export function validatePostingLines(lines: PostingLineInput[]) {
  if (lines.length < 2) return '凭证至少需要两行分录。'
  const invalid = lines.find(
    line => (line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0) || line.debit < 0 || line.credit < 0,
  )
  if (invalid) return '每行分录必须只填借方或贷方之一，且金额大于零。'
  const balance = validateBalance(lines)
  if (!balance.balanced) return `借贷不平：借方 ${balance.totalDebit}，贷方 ${balance.totalCredit}。`
  if (balance.totalDebit <= 0) return '凭证合计必须大于零。'
  return null
}

/**
 * 统一过账入口：所有子分类账（发票/收款/账单/付款/贷项/银行调整）
 * 经此函数生成已过账凭证并写入总分类账。
 * 强制：事务内执行、借贷平衡、期间开放、来源单据可追溯（sourceType/sourceId）。
 */
export async function createAndPostEntry(
  tx: Prisma.TransactionClient,
  input: PostEntryInput,
): Promise<PostedEntry> {
  const lineError = validatePostingLines(input.lines)
  if (lineError) throw new PostingError(lineError)

  const period = periodFromDate(input.entryDate)
  await assertPeriodOpen(tx, input.companyId, period)

  const voucherNo = await generateVoucherNo(input.entryDate, tx)
  const now = new Date()

  const entry = await tx.journalEntry.create({
    data: {
      voucherNo,
      entryDate: input.entryDate,
      description: input.description,
      period,
      status: 'POSTED',
      postedAt: now,
      attachments: input.attachments ?? [],
      companyId: input.companyId,
      createdById: input.createdById ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          accountId: line.accountId,
          lineNum: index + 1,
          description: line.description || input.description,
          debit: new Prisma.Decimal(roundMoney(line.debit)),
          credit: new Prisma.Decimal(roundMoney(line.credit)),
          notes: line.notes ?? '',
          partyId: line.partyId ?? null,
          costCenterId: line.costCenterId ?? null,
          projectId: line.projectId ?? null,
        })),
      },
    },
    include: postedEntryInclude,
  })

  await writeLedgerRows(
    tx,
    {
      id: entry.id,
      companyId: input.companyId,
      entryDate: entry.entryDate,
      voucherNo: entry.voucherNo,
      description: entry.description,
    },
    entry.lines,
  )

  return entry
}

export type ReverseEntryInput = {
  entryId: string
  /** 红冲凭证日期；默认沿用原凭证日期（同期冲销）。原期间已关账时调用方应传入开放期间日期。 */
  reversalDate?: Date
  createdById?: string | null
  reason?: string
}

/**
 * 红冲（反向凭证）：作废已过账单据的唯一方式。
 * 生成借贷对调的新凭证（reversalOfId 指向原凭证），原凭证标记 reversedAt。
 * 不删除任何已过账数据，保证审计轨迹完整。
 */
export async function reversePostedEntry(
  tx: Prisma.TransactionClient,
  input: ReverseEntryInput,
): Promise<PostedEntry> {
  const original = await tx.journalEntry.findUnique({
    where: { id: input.entryId },
    include: postedEntryInclude,
  })
  if (!original) throw new PostingError('原凭证不存在。')
  if (original.status !== 'POSTED') throw new PostingError('只有已过账凭证可以红冲。')
  if (original.reversedAt) throw new PostingError(`凭证 ${original.voucherNo} 已被红冲。`)
  if (!original.companyId) throw new PostingError('原凭证缺少所属公司。')

  const reversalDate = input.reversalDate ?? original.entryDate
  const period = periodFromDate(reversalDate)
  await assertPeriodOpen(tx, original.companyId, period)

  const voucherNo = await generateVoucherNo(reversalDate, tx)
  const description = input.reason
    ? `红冲 ${original.voucherNo}：${input.reason}`
    : `红冲 ${original.voucherNo}`
  const now = new Date()

  const reversal = await tx.journalEntry.create({
    data: {
      voucherNo,
      entryDate: reversalDate,
      description,
      period,
      status: 'POSTED',
      postedAt: now,
      companyId: original.companyId,
      createdById: input.createdById ?? null,
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      reversalOfId: original.id,
      lines: {
        create: original.lines.map(line => ({
          accountId: line.accountId,
          lineNum: line.lineNum,
          description: line.description,
          debit: line.credit, // 借贷对调
          credit: line.debit,
          notes: line.notes,
          partyId: line.partyId,
          costCenterId: line.costCenterId,
          projectId: line.projectId,
        })),
      },
    },
    include: postedEntryInclude,
  })

  await writeLedgerRows(
    tx,
    {
      id: reversal.id,
      companyId: original.companyId,
      entryDate: reversal.entryDate,
      voucherNo: reversal.voucherNo,
      description: reversal.description,
    },
    reversal.lines,
  )

  await tx.journalEntry.update({
    where: { id: original.id },
    data: { reversedAt: now },
  })

  return reversal
}
