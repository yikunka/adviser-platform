export const COS_CUSTOMER_FILE_KINDS = [
  'BUSINESS_LICENSE',
  'LEGAL_REP_ID',
  'TIANYANCHA_REPORT',
  'OTHER',
] as const

export type CosCustomerFileKind = typeof COS_CUSTOMER_FILE_KINDS[number]

export function normalizeCosCustomerFileKind(value: string | null | undefined): CosCustomerFileKind {
  const text = (value ?? '').trim()
  return COS_CUSTOMER_FILE_KINDS.includes(text as CosCustomerFileKind)
    ? text as CosCustomerFileKind
    : 'BUSINESS_LICENSE'
}
