export const TCSP_JURISDICTIONS = [
  { value: 'HK', label: 'HK' },
  { value: 'BVI', label: 'BVI' },
  { value: 'CAYMAN', label: 'Cayman' },
  { value: 'MARSHALL', label: 'Marshall' },
] as const

export const TCSP_CUSTOMER_LEVELS = [
  { value: 'DISTRIBUTOR', label: '经销客户' },
  { value: 'STANDARD', label: '普通客户' },
] as const

export type TcspJurisdiction = typeof TCSP_JURISDICTIONS[number]['value']
export type TcspCustomerLevel = typeof TCSP_CUSTOMER_LEVELS[number]['value']

export function normalizeTcspJurisdiction(value: string | null | undefined): TcspJurisdiction {
  const text = (value ?? '').trim().toUpperCase()
  return TCSP_JURISDICTIONS.some(item => item.value === text) ? text as TcspJurisdiction : 'HK'
}

export function normalizeTcspCustomerLevel(value: string | null | undefined): TcspCustomerLevel {
  const text = (value ?? '').trim().toUpperCase()
  return TCSP_CUSTOMER_LEVELS.some(item => item.value === text) ? text as TcspCustomerLevel : 'STANDARD'
}

export function tcspCustomerLevelLabel(value: string): string {
  return TCSP_CUSTOMER_LEVELS.find(item => item.value === value)?.label ?? value
}

export function normalizeTcspServiceContent(value: string | null | undefined): string | null {
  const text = (value ?? '').trim()
  return text ? text : null
}
