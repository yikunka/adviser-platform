/** Company engagement / service package tiers (admin company form). */
export const COMPANY_SERVICE_TIERS = [
  'COMP_SET_UP',
  'CS',
  'CS_VO',
  'CS_BK',
  'CS_VO_BK',
] as const

export type CompanyServiceTier = (typeof COMPANY_SERVICE_TIERS)[number]

export const COMPANY_SERVICE_TIER_LABELS: Record<CompanyServiceTier, string> = {
  COMP_SET_UP: 'Comp Set Up',
  CS: 'CS',
  CS_VO: 'CS+VO',
  CS_BK: 'CS+BK',
  CS_VO_BK: 'CS+VO+BK',
}
