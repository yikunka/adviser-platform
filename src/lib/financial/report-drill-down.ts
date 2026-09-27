import type { AccountType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { journalEntryInclude, serializeJournalEntriesWithHierarchy } from '@/lib/financial/journal-entry-serialization'
import { periodRange } from '@/lib/financial/reports'
import { roundMoney } from '@/lib/financial/utils'

export type ReportDrillDownMode = 'period' | 'ytd'

/** Synthetic consolidated report account ids look like `ASSET:1001`. */
export function isSyntheticReportAccountId(accountId: string): boolean {
  return /^[A-Z_]+:/.test(accountId)
}

export function parseSyntheticReportAccountId(accountId: string): { type: AccountType; code: string } | null {
  const match = /^([A-Z_]+):(.+)$/.exec(accountId)
  if (!match) return null
  return { type: match[1] as AccountType, code: match[2] }
}

/** Inclusive YYYY-MM list from calendar-year start through the selected period. */
export function periodsThroughSelected(period: string): string[] {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) {
    throw new Error('Invalid period. Use YYYY-MM.')
  }
  const periods: string[] = []
  for (let m = 1; m <= month; m++) {
    periods.push(`${year}-${String(m).padStart(2, '0')}`)
  }
  return periods
}

function collectDescendantIds(
  rootIds: string[],
  accounts: Array<{ id: string; parentId: string | null }>,
): string[] {
  const childrenByParent = new Map<string, string[]>()
  for (const account of accounts) {
    if (!account.parentId) continue
    const list = childrenByParent.get(account.parentId) ?? []
    list.push(account.id)
    childrenByParent.set(account.parentId, list)
  }

  const out = new Set<string>(rootIds)
  const queue = [...rootIds]
  while (queue.length > 0) {
    const id = queue.pop()!
    for (const childId of childrenByParent.get(id) ?? []) {
      if (out.has(childId)) continue
      out.add(childId)
      queue.push(childId)
    }
  }
  return [...out]
}

export async function resolveDrillDownAccountIds(input: {
  accountId: string
  companyIds: string[]
}): Promise<{ accountIds: string[]; code: string; name: string } | null> {
  const { accountId, companyIds } = input
  if (companyIds.length === 0) return null

  const companyAccounts = await prisma.finAccount.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, parentId: true, code: true, name: true, type: true, companyId: true },
  })

  let roots: typeof companyAccounts = []

  if (isSyntheticReportAccountId(accountId)) {
    const parsed = parseSyntheticReportAccountId(accountId)
    if (!parsed) return null
    roots = companyAccounts.filter(
      account => account.type === parsed.type && account.code === parsed.code,
    )
  } else {
    roots = companyAccounts.filter(account => account.id === accountId)
  }

  if (roots.length === 0) return null

  const accountIds = collectDescendantIds(
    roots.map(account => account.id),
    companyAccounts,
  )
  const primary = roots[0]
  return {
    accountIds,
    code: primary.code,
    name: primary.name,
  }
}

export async function loadReportDrillDown(input: {
  accountId: string
  period: string
  mode: ReportDrillDownMode
  companyIds: string[]
}) {
  // Validate period format early
  periodRange(input.period)

  if (input.accountId === 'computed' || input.accountId.startsWith('computed:')) {
    return {
      account: null as null,
      mode: input.mode,
      period: input.period,
      periods: [] as string[],
      vouchers: [] as Awaited<ReturnType<typeof serializeJournalEntriesWithHierarchy>>,
      matchedLines: [] as Array<{
        entryId: string
        voucherNo: string
        entryDate: string
        description: string
        accountCode: string
        accountName: string
        debit: number
        credit: number
        companyName: string | null
      }>,
      totalDebit: 0,
      totalCredit: 0,
      message: '该行为系统计算项，没有对应日记账分录可穿透。',
    }
  }

  const resolved = await resolveDrillDownAccountIds({
    accountId: input.accountId,
    companyIds: input.companyIds,
  })
  if (!resolved) {
    return {
      account: null,
      mode: input.mode,
      period: input.period,
      periods: [] as string[],
      vouchers: [],
      matchedLines: [],
      totalDebit: 0,
      totalCredit: 0,
      message: '找不到对应科目，无法穿透到凭证。',
    }
  }

  const periods = input.mode === 'ytd'
    ? periodsThroughSelected(input.period)
    : [input.period]

  const accountIdSet = new Set(resolved.accountIds)

  const where: Prisma.JournalEntryWhereInput = {
    status: 'POSTED',
    companyId: { in: input.companyIds },
    period: { in: periods },
    lines: { some: { accountId: { in: resolved.accountIds } } },
  }

  const entries = await prisma.journalEntry.findMany({
    where,
    include: journalEntryInclude,
    orderBy: [{ entryDate: 'asc' }, { voucherNo: 'asc' }],
  })

  const matchedLines: Array<{
    entryId: string
    voucherNo: string
    entryDate: string
    description: string
    accountCode: string
    accountName: string
    debit: number
    credit: number
    companyName: string | null
  }> = []

  let totalDebit = 0
  let totalCredit = 0

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!accountIdSet.has(line.accountId)) continue
      const debit = Number(line.debit)
      const credit = Number(line.credit)
      totalDebit = roundMoney(totalDebit + debit)
      totalCredit = roundMoney(totalCredit + credit)
      matchedLines.push({
        entryId: entry.id,
        voucherNo: entry.voucherNo,
        entryDate: entry.entryDate.toISOString(),
        description: line.description || entry.description,
        accountCode: line.account.code,
        accountName: line.account.name,
        debit,
        credit,
        companyName: entry.company?.nameEn ?? null,
      })
    }
  }

  const vouchers = await serializeJournalEntriesWithHierarchy(entries)

  return {
    account: {
      id: input.accountId,
      code: resolved.code,
      name: resolved.name,
      accountIds: resolved.accountIds,
    },
    mode: input.mode,
    period: input.period,
    periods,
    vouchers,
    matchedLines,
    totalDebit,
    totalCredit,
    message: null as string | null,
  }
}
