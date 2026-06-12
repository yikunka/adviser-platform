import { roundMoney } from '@/lib/financial/utils'

const DAY_MS = 24 * 60 * 60 * 1000
/** 自动匹配的日期容差（银行入账通常滞后 1-3 天） */
export const AUTO_MATCH_DATE_WINDOW_DAYS = 3

export type MatchableStatementLine = {
  id: string
  date: Date
  amount: number // 有符号：+流入 -流出
  reference: string
  description: string
}

export type MatchableLedgerRow = {
  id: string
  date: Date
  debit: number // 银行科目借方 = 流入
  credit: number // 银行科目贷方 = 流出
  voucherNo: string
  description: string
}

export type AutoMatchResult = {
  matches: Array<{ statementLineId: string; ledgerId: string; confidence: 'EXACT' | 'AMOUNT_DATE' }>
  unmatchedStatementLineIds: string[]
}

function ledgerSignedAmount(row: MatchableLedgerRow) {
  return roundMoney(row.debit - row.credit)
}

function withinWindow(a: Date, b: Date, days: number) {
  return Math.abs(a.getTime() - b.getTime()) <= days * DAY_MS
}

function referenceHit(line: MatchableStatementLine, row: MatchableLedgerRow) {
  const ref = line.reference.trim()
  if (!ref) return false
  return row.voucherNo.includes(ref) || row.description.includes(ref) || line.description.includes(row.voucherNo)
}

/**
 * 自动匹配：金额必须精确相等（含方向），优先参考号命中，
 * 其次日期容差内最近的一条。一条总账行只能匹配一条流水。
 */
export function autoMatchStatementLines(
  statementLines: MatchableStatementLine[],
  ledgerRows: MatchableLedgerRow[],
): AutoMatchResult {
  const usedLedgerIds = new Set<string>()
  const matches: AutoMatchResult['matches'] = []
  const unmatched: string[] = []

  for (const line of statementLines) {
    const candidates = ledgerRows.filter(
      row =>
        !usedLedgerIds.has(row.id)
        && ledgerSignedAmount(row) === roundMoney(line.amount)
        && withinWindow(line.date, row.date, AUTO_MATCH_DATE_WINDOW_DAYS),
    )
    if (candidates.length === 0) {
      unmatched.push(line.id)
      continue
    }
    const exact = candidates.find(row => referenceHit(line, row))
    const best = exact
      ?? candidates.slice().sort(
        (a, b) => Math.abs(a.date.getTime() - line.date.getTime()) - Math.abs(b.date.getTime() - line.date.getTime()),
      )[0]!
    usedLedgerIds.add(best.id)
    matches.push({
      statementLineId: line.id,
      ledgerId: best.id,
      confidence: exact ? 'EXACT' : 'AMOUNT_DATE',
    })
  }

  return { matches, unmatchedStatementLineIds: unmatched }
}

export type ReconciliationSummary = {
  statementBalance: number
  glBalance: number
  /** 对账单与总账的差额 */
  difference: number
  /** 未匹配流水合计（银行有、账上无 → 待入账） */
  unmatchedStatementTotal: number
  /** 未匹配总账行合计（账上有、银行无 → 未达账项，如在途存款/未兑现支票） */
  unmatchedLedgerTotal: number
  /** 调节后差额：difference - 未匹配流水 + 未匹配总账 = 0 时对账平 */
  unexplainedDifference: number
  isBalanced: boolean
}

/** 银行存款调节表：对账单余额 vs 总账余额，用未达账项解释差额。 */
export function computeReconciliationSummary(args: {
  statementBalance: number
  glBalance: number
  unmatchedStatementAmounts: number[]
  unmatchedLedgerSignedAmounts: number[]
}): ReconciliationSummary {
  const unmatchedStatementTotal = roundMoney(
    args.unmatchedStatementAmounts.reduce((sum, amount) => sum + amount, 0),
  )
  const unmatchedLedgerTotal = roundMoney(
    args.unmatchedLedgerSignedAmounts.reduce((sum, amount) => sum + amount, 0),
  )
  const difference = roundMoney(args.statementBalance - args.glBalance)
  // 对账单余额 - 未匹配流水 = 双方都确认的部分；总账余额 - 未匹配总账行 同理
  const unexplainedDifference = roundMoney(difference - unmatchedStatementTotal + unmatchedLedgerTotal)
  return {
    statementBalance: roundMoney(args.statementBalance),
    glBalance: roundMoney(args.glBalance),
    difference,
    unmatchedStatementTotal,
    unmatchedLedgerTotal,
    unexplainedDifference,
    isBalanced: Math.abs(unexplainedDifference) < 0.005,
  }
}
