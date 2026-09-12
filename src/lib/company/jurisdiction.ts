/** Company jurisdiction (stored in `Company.companyType`; drives company-code prefix). */
export const COMPANY_JURISDICTIONS = [
  'HONG_KONG',
  'BVI',
  'CAYMAN',
  'BERMUDA',
  'MARSHALL',
] as const

export type CompanyJurisdiction = (typeof COMPANY_JURISDICTIONS)[number]

export const COMPANY_JURISDICTION_LABELS: Record<CompanyJurisdiction, string> = {
  HONG_KONG: 'Hong Kong',
  BVI: 'BVI',
  CAYMAN: 'Cayman',
  BERMUDA: 'Bermuda',
  MARSHALL: 'Marshall',
}

export const COMPANY_JURISDICTION_CODE_PREFIX: Record<CompanyJurisdiction, string> = {
  HONG_KONG: 'AA',
  BVI: 'BV',
  CAYMAN: 'CA',
  BERMUDA: 'BM',
  MARSHALL: 'MS',
}
