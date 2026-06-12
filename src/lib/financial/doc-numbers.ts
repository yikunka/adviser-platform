type DocSequenceClient = {
  docSequence: {
    upsert(args: {
      where: { companyId_docType_periodKey: { companyId: string; docType: string; periodKey: string } }
      create: { companyId: string; docType: string; periodKey: string; lastNumber: number }
      update: Record<string, never>
    }): Promise<unknown>
    update(args: {
      where: { companyId_docType_periodKey: { companyId: string; docType: string; periodKey: string } }
      data: { lastNumber: { increment: number } }
    }): Promise<{ lastNumber: number }>
  }
}

/** 单据类型 → 单号前缀 */
export const DOC_NO_PREFIXES = {
  SALES_INVOICE: 'INV',
  RECEIPT: 'RCT',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  PURCHASE_BILL: 'BILL',
  BILL_PAYMENT: 'PAY',
} as const

export type DocNoType = keyof typeof DOC_NO_PREFIXES

export function docPeriodKey(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatDocNo(docType: DocNoType, periodKey: string, sequence: number) {
  return `${DOC_NO_PREFIXES[docType]}-${periodKey}-${String(sequence).padStart(4, '0')}`
}

/**
 * 并发安全的单据编号：DocSequence 行级 upsert + 原子 increment。
 * 必须在事务 (tx) 内调用，保证编号与单据创建同生共死。
 * 产出形如 INV-202606-0001（按公司 + 单据类型 + 月份独立序列）。
 */
export async function nextDocNo(
  client: DocSequenceClient,
  args: { companyId: string; docType: DocNoType; date: Date },
) {
  const periodKey = docPeriodKey(args.date)
  const where = {
    companyId_docType_periodKey: {
      companyId: args.companyId,
      docType: args.docType,
      periodKey,
    },
  }
  await client.docSequence.upsert({
    where,
    create: { companyId: args.companyId, docType: args.docType, periodKey, lastNumber: 0 },
    update: {},
  })
  const sequence = await client.docSequence.update({
    where,
    data: { lastNumber: { increment: 1 } },
  })
  return formatDocNo(args.docType, periodKey, sequence.lastNumber)
}
