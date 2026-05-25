/** Fixed option sets — aligned with client KYC form selectors */

export const KYC_TITLE_OPTIONS = ['Mr.', 'Ms.'] as const

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

export const BUSINESS_NATURE_OPTIONS = [
  { value: '001 - Agriculture and Fishing', label: '001 - Agriculture and Fishing' },
  { value: '002 - Mining and Quarrying', label: '002 - Mining and Quarrying' },
  { value: '003 - Manufacturing', label: '003 - Manufacturing' },
  { value: '005 - Electricity and Gas Supply', label: '005 - Electricity and Gas Supply' },
  { value: '006 - Water Supply, Sewerage, Waste Management and Remediation Activities', label: '006 - Water Supply, Sewerage, Waste Management and Remediation Activities' },
  { value: '007 - Import and Export Trade', label: '007 - Import and Export Trade' },
  { value: '008 - Wholesale', label: '008 - Wholesale' },
  { value: '009 - Retail Trade', label: '009 - Retail Trade' },
  { value: '010 - Accommodation Services', label: '010 - Accommodation Services' },
  { value: '011 - Food and Beverage Services', label: '011 - Food and Beverage Services' },
  { value: '012 - Land Transport', label: '012 - Land Transport' },
  { value: '013 - Water Transport', label: '013 - Water Transport' },
  { value: '014 - Air Transport', label: '014 - Air Transport' },
  { value: '015 - Warehousing and Support Activities for Transportation', label: '015 - Warehousing and Support Activities for Transportation' },
  { value: '016 - Postal and Courier Activities', label: '016 - Postal and Courier Activities' },
  { value: '017 - Publishing Activities', label: '017 - Publishing Activities' },
  { value: '018 - Motion Picture, Video and Television Programme Production, Sound Recording and Music Publishing Activities', label: '018 - Motion Picture, Video and Television Programme Production, Sound Recording and Music Publishing Activities' },
  { value: '019 - Programming and Broadcasting Activities', label: '019 - Programming and Broadcasting Activities' },
  { value: '020 - Telecommunications', label: '020 - Telecommunications' },
  { value: '021 - Computer Programming, Consultancy and Related Activities', label: '021 - Computer Programming, Consultancy and Related Activities' },
  { value: '022 - Information Service Activities', label: '022 - Information Service Activities' },
  { value: '023 - Financial Service Activities, Except Insurance and Pension Funding', label: '023 - Financial Service Activities, Except Insurance and Pension Funding' },
  { value: '024 - Insurance', label: '024 - Insurance' },
  { value: '025 - Activities Auxiliary to Financial Service and Insurance Activities', label: '025 - Activities Auxiliary to Financial Service and Insurance Activities' },
  { value: '026 - Real Estate Activities', label: '026 - Real Estate Activities' },
  { value: '027 - Legal and Accounting Activities', label: '027 - Legal and Accounting Activities' },
  { value: '028 - Activities of Head Offices; Management Consultancy Activities', label: '028 - Activities of Head Offices; Management Consultancy Activities' },
  { value: '029 - Architectural and Engineering Activities; Technical Testing and Analysis', label: '029 - Architectural and Engineering Activities; Technical Testing and Analysis' },
  { value: '030 - Scientific Research and Development', label: '030 - Scientific Research and Development' },
  { value: '031 - Advertising and Market Research', label: '031 - Advertising and Market Research' },
  { value: '032 - Other Professional, Scientific and Technical Activities', label: '032 - Other Professional, Scientific and Technical Activities' },
  { value: '033 - Veterinary Activities', label: '033 - Veterinary Activities' },
  { value: '035 - Rental and Leasing Activities', label: '035 - Rental and Leasing Activities' },
  { value: '036 - Employment Activities', label: '036 - Employment Activities' },
  { value: '037 - Travel Agency, Reservation Service and Related Activities', label: '037 - Travel Agency, Reservation Service and Related Activities' },
  { value: '038 - Security and Investigation Activities', label: '038 - Security and Investigation Activities' },
  { value: '039 - Services to Buildings and Landscape Activities', label: '039 - Services to Buildings and Landscape Activities' },
  { value: '041 - Public Administration and Defence; Compulsory Social Security', label: '041 - Public Administration and Defence; Compulsory Social Security' },
  { value: '042 - Education', label: '042 - Education' },
  { value: '043 - Human Health Activities', label: '043 - Human Health Activities' },
  { value: '045 - Residential Care Activities', label: '045 - Residential Care Activities' },
  { value: '046 - Social Work Activities without Accommodation', label: '046 - Social Work Activities without Accommodation' },
  { value: '047 - Creative, Arts and Entertainment Activities', label: '047 - Creative, Arts and Entertainment Activities' },
  { value: '049 - Libraries, Archives, Museums and Other Cultural Activities', label: '049 - Libraries, Archives, Museums and Other Cultural Activities' },
  { value: '050 - Gambling and Betting Activities', label: '050 - Gambling and Betting Activities' },
  { value: '051 - Sports Activities and Amusement and Recreation Activities', label: '051 - Sports Activities and Amusement and Recreation Activities' },
  { value: '052 - Activities of Membership Organizations', label: '052 - Activities of Membership Organizations' },
  { value: '053 - Repair of Computers and Personal and Household Goods', label: '053 - Repair of Computers and Personal and Household Goods' },
  { value: '055 - Other Personal Service Activities', label: '055 - Other Personal Service Activities' },
  { value: '056 - Activities of Households as Employers of Domestic Personnel', label: '056 - Activities of Households as Employers of Domestic Personnel' },
  { value: '058 - Activities of Extraterritorial Organizations and Bodies', label: '058 - Activities of Extraterritorial Organizations and Bodies' },
  { value: '059 - Import and export', label: '059 - Import and export' },
  { value: '060 - Investments', label: '060 - Investments' },
  { value: '061 - Property holding', label: '061 - Property holding' },
  { value: '062 - Construction', label: '062 - Construction' },
  { value: '063 - Money lending', label: '063 - Money lending' },
  { value: '064 - Securities', label: '064 - Securities' },
  { value: '065 - Advisory', label: '065 - Advisory' },
  { value: '066 - Dormant', label: '066 - Dormant' },
  { value: '068 - Consultancy', label: '068 - Consultancy' },
  { value: '069 - Trading', label: '069 - Trading' },
  { value: '070 - Management', label: '070 - Management' },
  { value: '071 - Decoration', label: '071 - Decoration' },
  { value: '072 - Catering', label: '072 - Catering' },
  { value: '073 - Asset management', label: '073 - Asset management' },
  { value: '074 - Design', label: '074 - Design' },
  { value: '075 - Logistic', label: '075 - Logistic' },
  { value: '077 - Pharmaceutical', label: '077 - Pharmaceutical' },
  { value: '078 - Technology', label: '078 - Technology' },
  { value: '079 - Engineering', label: '079 - Engineering' },
  { value: '080 - Services', label: '080 - Services' },
  { value: '081 - Telecommunication', label: '081 - Telecommunication' },
  { value: '082 - Promotion', label: '082 - Promotion' },
  { value: '084 - Corporate services', label: '084 - Corporate services' },
  { value: '085 - Marketing', label: '085 - Marketing' },
  { value: '086 - Photography', label: '086 - Photography' },
  { value: '087 - Retails', label: '087 - Retails' },
  { value: '088 - Property agency', label: '088 - Property agency' },
  { value: '090 - Manufacture', label: '090 - Manufacture' },
  { value: '091 - Trading and consultancy', label: '091 - Trading and consultancy' },
  { value: '092 - Entertainment', label: '092 - Entertainment' },
  { value: '093 - E-commerce', label: '093 - E-commerce' },
  { value: '094 - Education and training', label: '094 - Education and training' },
  { value: '095 - Food and beverage', label: '095 - Food and beverage' },
  { value: '096 - Jewellery', label: '096 - Jewellery' },
  { value: '097 - Healthcare', label: '097 - Healthcare' },
  { value: '098 - Innovation and technology', label: '098 - Innovation and technology' },
  { value: '099 - Others', label: '099 - Others' },
] as const

export const KYC_BUSINESS_NATURE_OPTIONS = BUSINESS_NATURE_OPTIONS
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
