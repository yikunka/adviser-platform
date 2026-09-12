/** Company lifecycle status (admin company form / filters). */
export const COMPANY_STATUSES = ['ACTIVE', 'INACTIVE', 'DEREGISTERED'] as const

export type CompanyStatusValue = (typeof COMPANY_STATUSES)[number]

export const COMPANY_STATUS_LABELS: Record<CompanyStatusValue, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DEREGISTERED: 'Deregistered',
}
