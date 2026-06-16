export const COMPANY_LEGAL_TYPE_VALUES = [
  'private company limited by shares',
  'public company limited by shares',
  'company limited by guarantee',
  'private unlimited company',
  'public unlimited company',
  'branch office',
  'BVI',
  'CAYMAN',
  'BERMUDA',
  'MARSHALL',
] as const

export type CompanyLegalType = (typeof COMPANY_LEGAL_TYPE_VALUES)[number]
