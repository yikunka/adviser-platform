/** Company service options (multi-select checkboxes on create/edit). */
export const COMPANY_SERVICE_OPTIONS = [
  'COMP_SET_UP',
  'COMP_SECRETARY',
  'VIRTUAL_OFFICE',
  'ACCT_SERVICE',
  'OTHER_SERVICE',
] as const

export type CompanyServiceOption = (typeof COMPANY_SERVICE_OPTIONS)[number]

export const COMPANY_SERVICE_OPTION_LABELS: Record<CompanyServiceOption, string> = {
  COMP_SET_UP: 'Comp Set Up',
  COMP_SECRETARY: 'Comp Secretary Service',
  VIRTUAL_OFFICE: 'Virtue Office',
  ACCT_SERVICE: 'Acct Service',
  OTHER_SERVICE: 'Other Service',
}

/** @deprecated Use COMPANY_SERVICE_OPTIONS — kept for any residual single-tier references during migrate. */
export const COMPANY_SERVICE_TIERS = COMPANY_SERVICE_OPTIONS
export type CompanyServiceTier = CompanyServiceOption
export const COMPANY_SERVICE_TIER_LABELS = COMPANY_SERVICE_OPTION_LABELS

export function formatCompanyServiceTiers(tiers: string[] | null | undefined): string {
  if (!tiers?.length) return '—'
  return tiers
    .map(t => COMPANY_SERVICE_OPTION_LABELS[t as CompanyServiceOption] ?? t)
    .join(', ')
}

export function normalizeCompanyServiceTiers(input: unknown): CompanyServiceOption[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set<string>(COMPANY_SERVICE_OPTIONS)
  const out: CompanyServiceOption[] = []
  for (const item of input) {
    if (typeof item === 'string' && allowed.has(item) && !out.includes(item as CompanyServiceOption)) {
      out.push(item as CompanyServiceOption)
    }
  }
  return out
}
