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

/** Chinese registration-place labels for company list / filters. */
export const COMPANY_JURISDICTION_LABELS_ZH: Record<CompanyJurisdiction, string> = {
  HONG_KONG: '香港',
  BVI: '英属维尔京',
  CAYMAN: '开曼',
  BERMUDA: '百慕大',
  MARSHALL: '马绍尔',
}

export const COMPANY_JURISDICTION_CODE_PREFIX: Record<CompanyJurisdiction, string> = {
  HONG_KONG: 'AA',
  BVI: 'BV',
  CAYMAN: 'CA',
  BERMUDA: 'BM',
  MARSHALL: 'MS',
}

export function companyJurisdictionLabelZh(companyType: string | null | undefined): string | null {
  if (!companyType) return null
  return COMPANY_JURISDICTION_LABELS_ZH[companyType as CompanyJurisdiction] ?? companyType
}
