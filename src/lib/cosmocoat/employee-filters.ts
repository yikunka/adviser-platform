import type { CosEmployeeBirthInfo } from '@/lib/cosmocoat/employee-birth-info'

export const COS_EMPLOYEE_FIVE_ELEMENTS = ['金', '木', '水', '火', '土'] as const
export type CosEmployeeFiveElement = (typeof COS_EMPLOYEE_FIVE_ELEMENTS)[number]

export function employeeMatchesFiveElement(
  employee: { birthInfo: CosEmployeeBirthInfo | null },
  fiveElement?: string | null,
) {
  if (!fiveElement) return true
  return employee.birthInfo?.fiveElement === fiveElement
}
