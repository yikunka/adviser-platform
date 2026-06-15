export type ImportFormat = 'line' | 'pair'

const HEADER_ALIASES: Record<string, string[]> = {
  voucherNo: ['voucher no', 'voucher number', 'voucherno', 'entry no', 'entry number', 'journal no', 'journal number', 'reference', 'ref', '凭证号', '憑證號', '分录号', '分錄號'],
  entryDate: ['date', 'entry date', 'journal date', 'posting date', '日期', '凭证日期', '憑證日期', '记账日期', '記賬日期'],
  description: ['description', 'entry description', 'memo', 'narration', '摘要', '描述', '说明', '說明'],
  accountCode: ['account code', 'account no', 'account number', '科目编码', '科目編碼', '科目代码', '科目代碼'],
  accountName: ['account name', 'account', '会计科目名称', '會計科目名稱', '科目名称', '科目名稱', '科目'],
  particular: ['particular', '凭证描述', '憑證描述'],
  lineDescription: ['line description', 'line memo', 'line narration', '明细摘要', '明細摘要', '分录摘要', '分錄摘要'],
  debit: ['debit', 'debit amount', 'dr', '借方', '借方金额', '借方金額'],
  credit: ['credit', 'credit amount', 'cr', '贷方', '貸方', '贷方金额', '貸方金額'],
  debitAccountCode: ['debit account code', 'debit account', 'dr account', '借方科目编码', '借方科目編碼', '借方科目'],
  creditAccountCode: ['credit account code', 'credit account', 'cr account', '贷方科目编码', '貸方科目編碼', '贷方科目', '貸方科目'],
  amount: ['amount', '金额', '金額'],
}

export function normalizeJournalImportHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[：:]/g, '')
    .replace(/\s+/g, ' ')
}

export function normalizeJournalImportLookupText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function buildJournalImportHeaderMap(headers: unknown[]) {
  const normalized = headers.map(normalizeJournalImportHeader)
  const map = new Map<string, number>()

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const candidates = aliases.map(normalizeJournalImportHeader)
    const index = normalized.findIndex(header => candidates.includes(header))
    if (index >= 0) map.set(field, index)
  }

  return map
}

export function detectJournalImportFormat(headerMap: Map<string, number>): ImportFormat | null {
  const hasPairFormat = headerMap.has('debitAccountCode')
    && headerMap.has('creditAccountCode')
    && headerMap.has('amount')
  const hasLineFormat = headerMap.has('entryDate')
    && (headerMap.has('description') || headerMap.has('particular'))
    && (headerMap.has('accountCode') || headerMap.has('accountName'))
    && headerMap.has('debit')
    && headerMap.has('credit')

  if (hasPairFormat) return 'pair'
  if (hasLineFormat) return 'line'
  return null
}
