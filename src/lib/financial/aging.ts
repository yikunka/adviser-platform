import { roundMoney } from '@/lib/financial/utils'

export const AGING_BUCKET_KEYS = ['notDue', 'd1to30', 'd31to60', 'd61to90', 'd90plus'] as const
export type AgingBucketKey = (typeof AGING_BUCKET_KEYS)[number]

export const AGING_BUCKET_LABELS: Record<AgingBucketKey, string> = {
  notDue: '未到期',
  d1to30: '1-30 天',
  d31to60: '31-60 天',
  d61to90: '61-90 天',
  d90plus: '90 天以上',
}

export type AgingDocInput = {
  docId: string
  docNo: string
  partyId: string
  partyName: string
  partyCode: string
  docDate: Date
  dueDate: Date | null
  outstanding: number
}

export type AgingBuckets = Record<AgingBucketKey, number>

export type AgingPartyRow = {
  partyId: string
  partyName: string
  partyCode: string
  buckets: AgingBuckets
  total: number
  docs: Array<AgingDocInput & { bucket: AgingBucketKey; daysOverdue: number }>
}

export type AgingReport = {
  asOf: string // YYYY-MM-DD
  parties: AgingPartyRow[]
  totals: AgingBuckets & { total: number }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 逾期天数：以 dueDate 为准，无 dueDate 时以单据日期为准（视同到期）。 */
export function daysOverdue(doc: { docDate: Date; dueDate: Date | null }, asOf: Date) {
  const reference = doc.dueDate ?? doc.docDate
  return Math.floor((asOf.getTime() - reference.getTime()) / DAY_MS)
}

export function agingBucketFor(days: number): AgingBucketKey {
  if (days <= 0) return 'notDue'
  if (days <= 30) return 'd1to30'
  if (days <= 60) return 'd31to60'
  if (days <= 90) return 'd61to90'
  return 'd90plus'
}

function emptyBuckets(): AgingBuckets {
  return { notDue: 0, d1to30: 0, d31to60: 0, d61to90: 0, d90plus: 0 }
}

/** AR / AP 通用账龄报表：按往来单位分组，按桶汇总未结金额。 */
export function buildAgingReport(docs: AgingDocInput[], asOf: Date): AgingReport {
  const byParty = new Map<string, AgingPartyRow>()

  for (const doc of docs) {
    if (doc.outstanding <= 0) continue
    let row = byParty.get(doc.partyId)
    if (!row) {
      row = {
        partyId: doc.partyId,
        partyName: doc.partyName,
        partyCode: doc.partyCode,
        buckets: emptyBuckets(),
        total: 0,
        docs: [],
      }
      byParty.set(doc.partyId, row)
    }
    const days = daysOverdue(doc, asOf)
    const bucket = agingBucketFor(days)
    row.buckets[bucket] = roundMoney(row.buckets[bucket] + doc.outstanding)
    row.total = roundMoney(row.total + doc.outstanding)
    row.docs.push({ ...doc, bucket, daysOverdue: Math.max(0, days) })
  }

  const parties = [...byParty.values()].sort((a, b) => b.total - a.total)
  const totals = { ...emptyBuckets(), total: 0 }
  for (const row of parties) {
    for (const key of AGING_BUCKET_KEYS) {
      totals[key] = roundMoney(totals[key] + row.buckets[key])
    }
    totals.total = roundMoney(totals.total + row.total)
  }

  return {
    asOf: asOf.toISOString().slice(0, 10),
    parties,
    totals,
  }
}
