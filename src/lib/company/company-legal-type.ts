export const COMPANY_LEGAL_TYPE_VALUES = [
  'Private Company Limited by Shares',
  'Public Company Limited by Shares',
  'Company Limited by Guarantee',
  'Private Unlimited Company',
  'Public Unlimited Company',
  'Branch Office',
] as const

export type CompanyLegalType = (typeof COMPANY_LEGAL_TYPE_VALUES)[number]

/** Map legacy lowercase values to the current labels. */
export const COMPANY_LEGAL_TYPE_LEGACY_MAP: Record<string, CompanyLegalType> = {
  'private company limited by shares': 'Private Company Limited by Shares',
  'public company limited by shares': 'Public Company Limited by Shares',
  'company limited by guarantee': 'Company Limited by Guarantee',
  'private unlimited company': 'Private Unlimited Company',
  'public unlimited company': 'Public Unlimited Company',
  'branch office': 'Branch Office',
}

export function normalizeCompanyLegalType(value: string | null | undefined): CompanyLegalType | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if ((COMPANY_LEGAL_TYPE_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as CompanyLegalType
  }
  return COMPANY_LEGAL_TYPE_LEGACY_MAP[trimmed.toLowerCase()] ?? null
}
