import type { KycPersonInput } from '@/lib/kyc/personZod'
import {
  KYC_ANNUAL_INCOME_OPTIONS,
  KYC_ASSET_ITEM_OPTIONS,
  KYC_NET_ASSET_OPTIONS,
  KYC_SOURCES_OF_WEALTH_OPTIONS,
  KYC_TITLE_OPTIONS,
  joinCommaList,
  splitCommaList,
} from '@/lib/kyc/kycFieldOptions'

/** Full KYC extraction payload aligned with KYC_Client.docx sections A–G (persisted KeyPerson fields). */
export type KycFullAnalysisFields = {
  titlePrefix?: string
  nameEn?: string
  nameZh?: string
  firstName?: string
  lastName?: string
  otherName?: string
  idType?: string
  idNumber?: string
  placeOfIssue?: string
  placeOfBirth?: string
  idExpiry?: string
  idExpiryPermanent?: boolean
  dateOfBirth?: string
  nationality?: string
  homeAddress?: string
  contactAddress?: string
  homePhone?: string
  workPhone?: string
  mobile?: string
  wechat?: string
  email?: string
  isUsCitizen?: boolean
  isPep?: boolean
  emergencyContact?: string
  employmentStatus?: 'EMPLOYED' | 'SELF_EMPLOYED' | 'RETIRED' | 'UNEMPLOYED'
  employerName?: string
  employerAddress?: string
  businessNatures?: string[]
  position?: string
  workingYears?: number
  sourceOfFunds?: string
  sourcesOfWealth?: string[]
  annualIncome?: string
  netAssetValue?: string
  assetItems?: string[]
  declarationSigned?: boolean
  signatureName?: string
  declarationDate?: string
}

export type KycAnalyzeDocRole = 'KYC_ID' | 'KYC_ADDRESS' | 'KYC_DECLARATION' | 'GENERIC'

const FULL_JSON_SHAPE = [
  '{',
  '"titlePrefix":"Mr.|Ms.|Mrs.|",',
  '"nameEn":"","nameZh":"","firstName":"","lastName":"","otherName":"",',
  '"idType":"HKID|PASSPORT|OTHER","idNumber":"","placeOfIssue":"","placeOfBirth":"",',
  '"idExpiry":"YYYY-MM-DD","idExpiryPermanent":false,"dateOfBirth":"YYYY-MM-DD","nationality":"",',
  '"homeAddress":"","contactAddress":"",',
  '"homePhone":"","workPhone":"","mobile":"","wechat":"","email":"",',
  '"isUsCitizen":false,"isPep":false,"emergencyContact":"",',
  '"employmentStatus":"EMPLOYED|SELF_EMPLOYED|RETIRED|UNEMPLOYED|",',
  '"employerName":"","employerAddress":"","businessNatures":[],"position":"","workingYears":null,',
  '"sourceOfFunds":"","sourcesOfWealth":[],"annualIncome":"","netAssetValue":"","assetItems":[],',
  '"declarationSigned":false,"signatureName":"","declarationDate":"YYYY-MM-DD"',
  '}',
].join('')

export function buildKycAnalysisPrompt(role: KycAnalyzeDocRole = 'GENERIC'): string {
  const focus =
    role === 'KYC_ID'
      ? 'This is an identity document (HKID/passport). Focus on name, idType, idNumber, placeOfIssue, idExpiry, dateOfBirth, nationality, placeOfBirth. Leave unrelated fields empty.'
      : role === 'KYC_ADDRESS'
        ? 'This is an address proof. Focus on homeAddress / residential address (and contactAddress if shown). Leave unrelated fields empty.'
        : role === 'KYC_DECLARATION'
          ? 'This is a completed Know Your Client (KYC) form for an individual client (sections A–G). Extract every filled field: identity, contact, occupation, financial profile, PEP, US tax residency, signature name and declaration date.'
          : 'Extract KYC identity and any other client fields visible on this document.'

  return [
    focus,
    'Return strict JSON only with this shape:',
    FULL_JSON_SHAPE,
    'Rules:',
    '- Use HKID, PASSPORT, or OTHER for idType where possible.',
    '- employmentStatus must be one of EMPLOYED, SELF_EMPLOYED, RETIRED, UNEMPLOYED when known.',
    '- sourcesOfWealth prefer: Salary/Bonus, Investment, Inheritance, Saving, Business Return.',
    '- assetItems prefer: Property, Deposits, Securities, Bonds/Fund, Virtual Asset, Insurance.',
    '- annualIncome prefer: <100,000 | 100,000–500,000 | 500,001–1,000,000 | 1,000,001+',
    '- netAssetValue prefer: <800,000 | 800,001–3,000,000 | 3,000,001+',
    '- businessNatures: short labels from the form checkboxes (e.g. Trading, Manufacturing, Investment holding).',
    '- Leave unknown fields as empty strings, empty arrays, false, or null.',
  ].join('\n')
}

export function normalizeFullKycFields(value: unknown): KycFullAnalysisFields {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const idTypeRaw = clean(record['idType'])?.toUpperCase()
  const idType =
    idTypeRaw === 'HKID' || idTypeRaw === 'PASSPORT' || idTypeRaw === 'OTHER'
      ? idTypeRaw
      : clean(record['idType'])

  const employmentRaw = clean(record['employmentStatus'])?.toUpperCase().replace(/[\s-]+/g, '_')
  const employmentStatus =
    employmentRaw === 'EMPLOYED'
    || employmentRaw === 'SELF_EMPLOYED'
    || employmentRaw === 'RETIRED'
    || employmentRaw === 'UNEMPLOYED'
      ? employmentRaw
      : undefined

  const title = clean(record['titlePrefix'])
  const titlePrefix = title
    ? (KYC_TITLE_OPTIONS as readonly string[]).includes(title)
      ? title
      : title.toLowerCase().startsWith('mr')
        ? 'Mr.'
        : title.toLowerCase().startsWith('ms') || title.toLowerCase().startsWith('miss')
          ? 'Ms.'
          : title
    : undefined

  return {
    titlePrefix,
    nameEn: clean(record['nameEn']),
    nameZh: clean(record['nameZh']),
    firstName: clean(record['firstName']),
    lastName: clean(record['lastName']),
    otherName: clean(record['otherName']),
    idType,
    idNumber: clean(record['idNumber']),
    placeOfIssue: clean(record['placeOfIssue']),
    placeOfBirth: clean(record['placeOfBirth']),
    idExpiry: normalizeDate(clean(record['idExpiry'])),
    idExpiryPermanent: asBool(record['idExpiryPermanent']),
    dateOfBirth: normalizeDate(clean(record['dateOfBirth'])),
    nationality: clean(record['nationality']),
    homeAddress: clean(record['homeAddress']),
    contactAddress: clean(record['contactAddress']),
    homePhone: clean(record['homePhone']),
    workPhone: clean(record['workPhone']),
    mobile: clean(record['mobile']),
    wechat: clean(record['wechat']),
    email: clean(record['email']),
    isUsCitizen: asBool(record['isUsCitizen']),
    isPep: asBool(record['isPep']),
    emergencyContact: clean(record['emergencyContact']),
    employmentStatus,
    employerName: clean(record['employerName']),
    employerAddress: clean(record['employerAddress']),
    businessNatures: asStringList(record['businessNatures']),
    position: clean(record['position']),
    workingYears: asInt(record['workingYears']),
    sourceOfFunds: clean(record['sourceOfFunds']),
    sourcesOfWealth: normalizeWealth(asStringList(record['sourcesOfWealth'])),
    annualIncome: normalizeIncome(clean(record['annualIncome'])),
    netAssetValue: normalizeNetAsset(clean(record['netAssetValue'])),
    assetItems: normalizeAssets(asStringList(record['assetItems'])),
    declarationSigned: asBool(record['declarationSigned']),
    signatureName: clean(record['signatureName']),
    declarationDate: normalizeDate(clean(record['declarationDate'])),
  }
}

/** Overlay non-empty analysis fields onto a draft. Later sources win. */
export function applyAnalysisToDraft(
  base: KycPersonInput,
  analysis: KycFullAnalysisFields,
): KycPersonInput {
  const next: KycPersonInput = { ...base }

  const setStr = (key: keyof KycPersonInput, value: string | undefined | null) => {
    if (value == null || !String(value).trim()) return
    ;(next as Record<string, unknown>)[key as string] = String(value).trim()
  }
  const setBool = (key: keyof KycPersonInput, value: boolean | undefined) => {
    if (value === undefined) return
    ;(next as Record<string, unknown>)[key as string] = value
  }

  setStr('titlePrefix', analysis.titlePrefix)
  setStr('nameEn', analysis.nameEn)
  setStr('nameZh', analysis.nameZh)
  setStr('firstName', analysis.firstName)
  setStr('lastName', analysis.lastName)
  setStr('otherName', analysis.otherName)

  if (analysis.nameEn && !analysis.firstName && !analysis.lastName) {
    const parts = analysis.nameEn.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 1) setStr('firstName', parts[0])
    else if (parts.length > 1) {
      setStr('firstName', parts.slice(0, -1).join(' '))
      setStr('lastName', parts.at(-1))
    }
  }

  setStr('idType', analysis.idType)
  setStr('idNumber', analysis.idNumber)
  setStr('placeOfIssue', analysis.placeOfIssue)
  setStr('placeOfBirth', analysis.placeOfBirth)
  if (analysis.idExpiryPermanent) {
    next.idExpiryPermanent = true
    next.idExpiry = ''
  } else {
    setStr('idExpiry', analysis.idExpiry)
    if (analysis.idExpiry) next.idExpiryPermanent = false
  }
  setStr('dateOfBirth', analysis.dateOfBirth)
  setStr('nationality', analysis.nationality)
  setStr('homeAddress', analysis.homeAddress)
  setStr('contactAddress', analysis.contactAddress)
  // If only residential address present, also seed correspondence when empty
  if (analysis.homeAddress && !String(next.contactAddress ?? '').trim()) {
    next.contactAddress = analysis.homeAddress
  }
  setStr('homePhone', analysis.homePhone)
  setStr('workPhone', analysis.workPhone)
  setStr('mobile', analysis.mobile)
  setStr('wechat', analysis.wechat)
  setStr('email', analysis.email)
  setBool('isUsCitizen', analysis.isUsCitizen)
  setBool('isPep', analysis.isPep)
  setStr('emergencyContact', analysis.emergencyContact)
  if (analysis.employmentStatus) next.employmentStatus = analysis.employmentStatus
  setStr('employerName', analysis.employerName)
  setStr('employerAddress', analysis.employerAddress)
  if (analysis.businessNatures?.length) {
    next.businessNaturesText = joinCommaList(analysis.businessNatures)
  }
  setStr('position', analysis.position)
  if (analysis.workingYears != null) next.workingYears = analysis.workingYears
  setStr('sourceOfFunds', analysis.sourceOfFunds)
  if (analysis.sourcesOfWealth?.length) {
    next.sourcesOfWealthText = joinCommaList(analysis.sourcesOfWealth)
  }
  setStr('annualIncome', analysis.annualIncome)
  setStr('netAssetValue', analysis.netAssetValue)
  if (analysis.assetItems?.length) {
    next.assetItemsText = joinCommaList(analysis.assetItems)
  }
  setBool('declarationSigned', analysis.declarationSigned)
  setStr('signatureName', analysis.signatureName)
  setStr('declarationDate', analysis.declarationDate)

  return next
}

export function mergeDocumentAnalyses(input: {
  base: KycPersonInput
  id?: KycFullAnalysisFields
  address?: KycFullAnalysisFields
  declaration?: KycFullAnalysisFields
}): KycPersonInput {
  // Priority: existing record → ID → address proof → filled KYC form (declaration wins)
  let draft = { ...input.base }
  if (input.id) draft = applyAnalysisToDraft(draft, input.id)
  if (input.address) draft = applyAnalysisToDraft(draft, input.address)
  if (input.declaration) draft = applyAnalysisToDraft(draft, input.declaration)
  return draft
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : undefined
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1', '是'].includes(v)) return true
    if (['false', 'no', 'n', '0', '否'].includes(v)) return false
  }
  return undefined
}

function asInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim())
    if (Number.isFinite(n)) return Math.round(n)
  }
  return undefined
}

function asStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const list = value.map(v => clean(v)).filter((v): v is string => Boolean(v))
    return list.length ? list : undefined
  }
  if (typeof value === 'string' && value.trim()) {
    const list = splitCommaList(value)
    return list.length ? list : undefined
  }
  return undefined
}

function normalizeDate(value: string | undefined) {
  if (!value) return undefined
  const raw = value.trim()
  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return undefined
}

function normalizeIncome(value: string | undefined) {
  if (!value) return undefined
  const v = value.replace(/\s/g, '')
  if (v.includes('>') || v.includes('1,000,001') || v.includes('1000001')) return '1,000,001+'
  for (const opt of KYC_ANNUAL_INCOME_OPTIONS) {
    if (value.includes(opt.replace(/–/g, '-')) || value.includes(opt)) return opt
  }
  if (v.includes('100,000-500') || v.includes('100000-500')) return '100,000–500,000'
  if (v.includes('500,001') || v.includes('500001')) return '500,001–1,000,000'
  if (v.includes('<100') || v.startsWith('<')) return '<100,000'
  return value
}

function normalizeNetAsset(value: string | undefined) {
  if (!value) return undefined
  const v = value.replace(/\s/g, '')
  if (v.includes('>') || v.includes('3,000,001') || v.includes('3000001')) return '3,000,001+'
  for (const opt of KYC_NET_ASSET_OPTIONS) {
    if (value.includes(opt)) return opt
  }
  if (v.includes('800,001') || v.includes('800001')) return '800,001–3,000,000'
  if (v.includes('<800') || v.startsWith('<')) return '<800,000'
  return value
}

function normalizeWealth(list: string[] | undefined) {
  if (!list?.length) return undefined
  const mapped = list.map(item => {
    const lower = item.toLowerCase()
    const hit = KYC_SOURCES_OF_WEALTH_OPTIONS.find(opt =>
      lower.includes(opt.value.toLowerCase())
      || lower.includes(opt.label.split(' ')[0]!.toLowerCase())
      || (lower.includes('salary') && opt.value === 'Salary/Bonus')
      || (lower.includes('business') && opt.value === 'Business Return')
      || (lower.includes('saving') && opt.value === 'Saving')
      || (lower.includes('inherit') && opt.value === 'Inheritance')
      || (lower.includes('invest') && opt.value === 'Investment'),
    )
    return hit?.value ?? item
  })
  return mapped
}

function normalizeAssets(list: string[] | undefined) {
  if (!list?.length) return undefined
  return list.map(item => {
    const lower = item.toLowerCase()
    const hit = KYC_ASSET_ITEM_OPTIONS.find(opt =>
      lower.includes(opt.value.toLowerCase())
      || (lower.includes('property') && opt.value === 'Property')
      || (lower.includes('deposit') && opt.value === 'Deposits')
      || (lower.includes('securit') && opt.value === 'Securities')
      || ((lower.includes('bond') || lower.includes('fund')) && opt.value === 'Bonds/Fund')
      || (lower.includes('virtual') && opt.value === 'Virtual Asset')
      || (lower.includes('insurance') && opt.value === 'Insurance'),
    )
    return hit?.value ?? item
  })
}
