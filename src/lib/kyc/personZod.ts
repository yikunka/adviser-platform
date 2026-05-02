import { z } from 'zod'

/** Single natural-person KYC payload — fields align with `KeyPerson` + portal-only inputs */
export const kycPersonZod = z.object({
  id: z.string().optional(),
  titlePrefix: z.string().max(20).optional().nullable(),
  nameEn: z.string().min(1).max(100),
  nameZh: z.string().max(100).optional().nullable(),
  idType: z.string().max(50).optional().nullable(),
  idNumber: z.string().max(50).optional().nullable(),
  placeOfIssue: z.string().max(100).optional().nullable(),
  placeOfBirth: z.string().max(200).optional().nullable(),
  idExpiry: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
  homeAddress: z.string().max(2000).optional().nullable(),
  contactAddress: z.string().max(2000).optional().nullable(),
  homePhone: z.string().max(30).optional().nullable(),
  workPhone: z.string().max(30).optional().nullable(),
  mobile: z.string().max(30).optional().nullable(),
  wechat: z.string().max(100).optional().nullable(),
  email: z.union([z.string().email().max(255), z.literal('')]).optional().nullable(),
  isUsCitizen: z.boolean().optional().nullable(),
  isPep: z.boolean().optional().nullable(),
  emergencyContact: z.string().max(500).optional().nullable(),
  employmentStatus: z
    .union([z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'UNEMPLOYED']), z.literal('')])
    .optional()
    .nullable(),
  employerName: z.string().max(200).optional().nullable(),
  employerAddress: z.string().max(2000).optional().nullable(),
  /** Comma- or newline-separated; stored as String[] in DB */
  businessNaturesText: z.string().max(2000).optional().nullable(),
  position: z.string().max(150).optional().nullable(),
  workingYears: z.preprocess(
    (v) => (v === '' || v == null || Number.isNaN(v) ? undefined : v),
    z.number().int().min(0).max(80).optional()
  ),
  sourceOfFunds: z.string().max(2000).optional().nullable(),
  /** Comma- or newline-separated */
  sourcesOfWealthText: z.string().max(2000).optional().nullable(),
  annualIncome: z.string().max(100).optional().nullable(),
  netAssetValue: z.string().max(100).optional().nullable(),
  /** Comma- or newline-separated */
  assetItemsText: z.string().max(2000).optional().nullable(),
  declarationSigned: z.boolean().optional().nullable(),
  signatureName: z.string().max(200).optional().nullable(),
  declarationDate: z.string().optional().nullable(),
})

export type KycPersonInput = z.infer<typeof kycPersonZod>

export const kycBatchZod = z.object({
  persons: z.array(kycPersonZod).min(1, 'Add at least one person'),
  action: z.enum(['SAVE_DRAFT', 'SUBMIT']).default('SAVE_DRAFT'),
})

function splitList(s: string | null | undefined): string[] {
  if (!s?.trim()) return []
  return s
    .split(/[\n,，;；]+/)
    .map(x => x.trim())
    .filter(Boolean)
}

/** JSON from `/api/*` has ISO date strings, not `Date` instances. */
function dateToYmd(d: Date | string | null | undefined): string {
  if (d == null) return ''
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
    const t = new Date(d).getTime()
    return Number.isNaN(t) ? '' : new Date(t).toISOString().split('T')[0]
  }
  return d.toISOString().split('T')[0]
}

function asStringArray(x: unknown): string[] {
  if (Array.isArray(x)) return x.map((v) => String(v))
  return []
}

export function inputToKeyPersonData(
  data: KycPersonInput,
  action: 'SAVE_DRAFT' | 'SUBMIT'
) {
  const rawEst = data.employmentStatus
  const est =
    rawEst == null || rawEst === ''
      ? undefined
      : rawEst
  return {
    titlePrefix: data.titlePrefix ?? undefined,
    nameEn: data.nameEn,
    nameZh: data.nameZh ?? undefined,
    idType: data.idType ?? undefined,
    idNumber: data.idNumber ?? undefined,
    placeOfIssue: data.placeOfIssue ?? undefined,
    placeOfBirth: data.placeOfBirth ?? undefined,
    idExpiryDate: data.idExpiry ? new Date(data.idExpiry) : undefined,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    nationality: data.nationality ?? undefined,
    homeAddress: data.homeAddress ?? undefined,
    contactAddress: data.contactAddress ?? undefined,
    homePhone: data.homePhone ?? undefined,
    workPhone: data.workPhone ?? undefined,
    mobile: data.mobile ?? undefined,
    wechat: data.wechat ?? undefined,
    email: data.email && data.email !== '' ? data.email : undefined,
    isUsCitizen: data.isUsCitizen ?? undefined,
    isPep: data.isPep ?? undefined,
    emergencyContact: data.emergencyContact ?? undefined,
    employmentStatus: est,
    employerName: data.employerName ?? undefined,
    employerAddress: data.employerAddress ?? undefined,
    businessNatures: splitList(data.businessNaturesText),
    position: data.position ?? undefined,
    workingYears: data.workingYears ?? undefined,
    sourceOfFunds: data.sourceOfFunds ?? undefined,
    sourcesOfWealth: splitList(data.sourcesOfWealthText),
    annualIncome: data.annualIncome ?? undefined,
    netAssetValue: data.netAssetValue ?? undefined,
    assetItems: splitList(data.assetItemsText),
    declarationSigned: data.declarationSigned ?? false,
    signatureName: data.signatureName ?? undefined,
    declarationDate: data.declarationDate ? new Date(data.declarationDate) : undefined,
    kycStatus: action === 'SUBMIT' ? ('SUBMITTED' as const) : ('DRAFT' as const),
  }
}

export function keyPersonToFormValues(p: {
  id: string
  titlePrefix: string | null
  nameEn: string
  nameZh: string | null
  idType: string | null
  idNumber: string | null
  placeOfIssue: string | null
  placeOfBirth: string | null
  idExpiryDate: Date | string | null
  dateOfBirth: Date | string | null
  nationality: string | null
  homeAddress: string | null
  contactAddress: string | null
  homePhone: string | null
  workPhone: string | null
  mobile: string | null
  wechat: string | null
  email: string | null
  isUsCitizen: boolean | null
  isPep: boolean | null
  emergencyContact: string | null
  employmentStatus: string | null
  employerName: string | null
  employerAddress: string | null
  businessNatures: string[] | null
  position: string | null
  workingYears: number | null
  sourceOfFunds: string | null
  sourcesOfWealth: string[] | null
  annualIncome: string | null
  netAssetValue: string | null
  assetItems: string[] | null
  declarationSigned: boolean
  signatureName: string | null
  declarationDate: Date | string | null
}): KycPersonInput {
  const businessNatures = asStringArray(p.businessNatures)
  const sourcesOfWealth = asStringArray(p.sourcesOfWealth)
  const assetItems = asStringArray(p.assetItems)

  return {
    id: p.id,
    titlePrefix: p.titlePrefix,
    nameEn: p.nameEn,
    nameZh: p.nameZh,
    idType: p.idType,
    idNumber: p.idNumber,
    placeOfIssue: p.placeOfIssue,
    placeOfBirth: p.placeOfBirth,
    idExpiry: dateToYmd(p.idExpiryDate),
    dateOfBirth: dateToYmd(p.dateOfBirth),
    nationality: p.nationality,
    homeAddress: p.homeAddress,
    contactAddress: p.contactAddress,
    homePhone: p.homePhone,
    workPhone: p.workPhone,
    mobile: p.mobile,
    wechat: p.wechat,
    email: p.email ?? '',
    isUsCitizen: p.isUsCitizen ?? false,
    isPep: p.isPep ?? false,
    emergencyContact: p.emergencyContact,
    employmentStatus: (p.employmentStatus ?? '') as KycPersonInput['employmentStatus'],
    employerName: p.employerName,
    employerAddress: p.employerAddress,
    businessNaturesText: businessNatures.join('\n'),
    position: p.position,
    workingYears: p.workingYears ?? undefined,
    sourceOfFunds: p.sourceOfFunds,
    sourcesOfWealthText: sourcesOfWealth.join('\n'),
    annualIncome: p.annualIncome,
    netAssetValue: p.netAssetValue,
    assetItemsText: assetItems.join('\n'),
    declarationSigned: p.declarationSigned,
    signatureName: p.signatureName,
    declarationDate: dateToYmd(p.declarationDate),
  }
}
