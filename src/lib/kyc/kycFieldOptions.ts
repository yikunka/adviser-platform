/** Fixed option sets — aligned with client KYC form selectors */

export const KYC_TITLE_OPTIONS = ['Mr.', 'Ms.', 'Mrs.'] as const

export const KYC_ID_TYPE_OPTIONS = [
  { value: 'HKID', label: 'HK ID Card 香港身份證' },
  { value: 'PASSPORT', label: 'Passport 護照' },
  { value: 'OTHER', label: 'Other 其他' },
] as const

export const KYC_EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'EMPLOYED', labelKey: 'employed' as const },
  { value: 'SELF_EMPLOYED', labelKey: 'selfEmployed' as const },
  { value: 'RETIRED', labelKey: 'retired' as const },
  { value: 'UNEMPLOYED', labelKey: 'unemployed' as const },
] as const

export const KYC_BUSINESS_NATURE_OPTIONS = [
  { value: 'Property investment', label: 'Property investment 物業投資' },
  { value: 'Financial institution', label: 'Financial institution 金融機構' },
  { value: 'Trading', label: 'Trading 貿易' },
  { value: 'Manufacturing', label: 'Manufacturing 製造業' },
  { value: 'Agent/Consultancy', label: 'Agent/Consultancy 代理或諮詢業務' },
  { value: 'Investment holding', label: 'Investment holding 投資控股' },
  { value: 'Financial service', label: 'Financial service 金融服務業' },
  { value: 'Dormant', label: 'Dormant 不活躍' },
  { value: 'IT', label: 'IT 資訊業' },
  { value: 'Advertising', label: 'Advertising 廣告業' },
  { value: 'Restaurant', label: 'Restaurant 飲食業' },
  { value: 'Medical service', label: 'Medical service 醫療服務業' },
] as const

export const KYC_BUSINESS_NATURE_FIXED = KYC_BUSINESS_NATURE_OPTIONS.map((o) => o.value)

export const KYC_SOURCES_OF_WEALTH_OPTIONS = [
  { value: 'Salary/Bonus', label: 'Salary and/or Bonus 薪金與花紅' },
  { value: 'Investment', label: 'Investment 投資' },
  { value: 'Inheritance', label: 'Inheritance 承繼' },
  { value: 'Saving', label: 'Saving 儲蓄' },
  { value: 'Business Return', label: 'Business Return 生意' },
] as const

export const KYC_SOURCES_OF_WEALTH_FIXED = KYC_SOURCES_OF_WEALTH_OPTIONS.map((o) => o.value)

export const KYC_ANNUAL_INCOME_OPTIONS = [
  '<100,000',
  '100,000–500,000',
  '500,001–1,000,000',
  '1,000,001+',
] as const

export const KYC_NET_ASSET_OPTIONS = ['<800,000', '800,001–3,000,000', '3,000,001+'] as const

export const KYC_ASSET_ITEM_OPTIONS = [
  { value: 'Property', label: 'Property 房產' },
  { value: 'Deposits', label: 'Deposits 存款' },
  { value: 'Securities', label: 'Securities 證券' },
  { value: 'Bonds/Fund', label: 'Bonds/Fund 債券/基金' },
  { value: 'Virtual Asset', label: 'Virtual Asset 虛擬資產' },
  { value: 'Insurance', label: 'Insurance 保險' },
] as const

export function splitCommaList(s: string | null | undefined): string[] {
  return (s ?? '').split(/[\n,，;；]+/).map((x) => x.trim()).filter(Boolean)
}

export function joinCommaList(items: string[]): string {
  return items.join(', ')
}
