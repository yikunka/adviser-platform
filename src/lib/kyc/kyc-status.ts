/** KYC / natural-person review status (stored on KeyPerson.kycStatus). */
export const KYC_STATUS_VALUES = ['DRAFT', 'APPROVED', 'REJECTED', 'INACTIVE'] as const

export type KycStatusValue = (typeof KYC_STATUS_VALUES)[number]

export const KYC_STATUS_LABELS: Record<KycStatusValue, string> = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  INACTIVE: 'Inactive',
}

export function kycStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return KYC_STATUS_LABELS[status as KycStatusValue] ?? status
}
