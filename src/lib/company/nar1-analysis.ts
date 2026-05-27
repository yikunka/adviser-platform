import { extractPdfText } from '@/lib/pdf/extract-text'
import { renderPdfPages } from '@/lib/pdf/render-pages'

export type NAR1DirectorInfo = {
  nameEn: string
  nameZh?: string
  idType?: 'HKID' | 'PASSPORT' | 'OTHER'
  idNumber?: string
  nationality?: string
  addressForService?: string
  dateOfAppointment?: string
  dateAsReserve?: string
  dateOfCessation?: string | null
  dateOfBirth?: string
  placeOfBirth?: string
  countryOfIssuance?: string
  isReserveDirector?: boolean
  isCorporation?: boolean
  corpRegNumber?: string
  corpRegPlace?: string
}

export type NAR1MemberInfo = {
  nameEn: string
  nameZh?: string
  registeredAddress?: string
  shareClass?: string
  sharesHeld?: number
  occupation?: string
  idNumber?: string
  isTransferred?: boolean
  becomingDate?: string
}

export type NAR1ControllerInfo = {
  nameEn: string
  nameZh?: string
  idType?: 'HKID' | 'PASSPORT' | 'OTHER'
  idNumber?: string
  idPassportNo?: string
  issuingCountry?: string
  correspondenceAddress?: string
  natureOfControl?: string
  entryDate?: string
  becomingDate?: string
  cessationDate?: string
  isLegalEntity?: boolean
  legalEntityRegNo?: string
  legalEntityGovLaw?: string
  remarks?: string
}

export type NAR1AnalysisResult = {
  directors: NAR1DirectorInfo[]
  members: NAR1MemberInfo[]
  significantControllers: NAR1ControllerInfo[]
  companyNameEn?: string
  companyNameZh?: string
  companyNumber?: string
  annualReturnDate?: string
  source: 'bailian' | 'fallback'
}

type PreparedFile = {
  fileName: string
  mimeType: string
  base64: string
  text: string
  images: Array<{
    mimeType: 'image/png'
    base64: string
    label: string
  }>
}

const ANALYSIS_MODEL = 'qwen3.5-flash'
const MAX_TEXT_CHARS = 15000
const MAX_PDF_IMAGE_PAGES = 12

export async function analyzeNAR1Document(file: File): Promise<NAR1AnalysisResult> {
  const prepared = await prepareFile(file)
  const apiKey = getBailianApiKey()

  if (!apiKey) {
    return fallbackAnalyze(prepared)
  }

  try {
    const analyzed = await analyzeWithBailian(prepared, apiKey)
    return { ...analyzed, source: 'bailian' as const }
  } catch (error) {
    console.error('[nar1-analysis] Bailian analysis failed:', error)
    return fallbackAnalyze(prepared)
  }
}

async function prepareFile(file: File): Promise<PreparedFile> {
  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || guessMimeType(file.name)
  const text = mimeType === 'application/pdf'
    ? await extractPdfText(bytes, MAX_TEXT_CHARS)
    : ''
  const images = mimeType === 'application/pdf'
    ? await renderPdfPages(bytes, file.name, {
        maxPages: MAX_PDF_IMAGE_PAGES,
        logPrefix: '[nar1-analysis]',
      })
    : []

  return {
    fileName: file.name,
    mimeType,
    base64: bytes.toString('base64'),
    text,
    images,
  }
}

function getBailianApiKey() {
  return (
    process.env['DASHSCOPE_API_KEY'] ??
    process.env['BAILIAN_API_KEY'] ??
    process.env['ALIYUN_BAILIAN_API_KEY'] ??
    ''
  ).trim()
}

async function analyzeWithBailian(file: PreparedFile, apiKey: string): Promise<NAR1AnalysisResult> {
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `You are analyzing a Hong Kong Annual Return (NAR1) document. Extract filled-in data (not blank form labels) and return strict JSON only.

Return JSON with this exact structure:
{
  "companyNameEn": "Company Name in English",
  "companyNameZh": "公司中文名稱",
  "companyNumber": "Business Registration Number",
  "annualReturnDate": "YYYY-MM-DD",
  "directors": [
    {
      "nameEn": "Director English Name (Surname + Other Names)",
      "nameZh": "董事中文姓名",
      "idType": "HKID|PASSPORT|OTHER",
      "idNumber": "HKID/Passport partial or full number",
      "nationality": "Nationality",
      "countryOfIssuance": "Issuing country for passport",
      "addressForService": "Correspondence / service address",
      "dateOfAppointment": "YYYY-MM-DD",
      "dateAsReserve": "YYYY-MM-DD or null",
      "dateOfCessation": "YYYY-MM-DD or null",
      "dateOfBirth": "YYYY-MM-DD",
      "placeOfBirth": "Place of birth",
      "isReserveDirector": false,
      "isCorporation": false,
      "corpRegNumber": "BR number if body corporate director",
      "corpRegPlace": "Place of registration if body corporate"
    }
  ],
  "members": [
    {
      "nameEn": "Member English Name",
      "nameZh": "成員中文姓名",
      "registeredAddress": "Registered / correspondence address",
      "shareClass": "Ordinary|Preference|Other",
      "sharesHeld": 1000,
      "occupation": "Occupation if shown",
      "becomingDate": "YYYY-MM-DD",
      "isTransferred": false
    }
  ],
  "significantControllers": [
    {
      "nameEn": "Controller English Name",
      "nameZh": "控权人中文姓名",
      "idType": "HKID|PASSPORT|OTHER",
      "idNumber": "ID/Passport number",
      "issuingCountry": "Issuing country",
      "correspondenceAddress": "Correspondence address",
      "natureOfControl": "Nature of control (e.g. holds more than 25% shares)",
      "entryDate": "YYYY-MM-DD",
      "becomingDate": "YYYY-MM-DD",
      "cessationDate": "YYYY-MM-DD or null",
      "isLegalEntity": false,
      "legalEntityRegNo": "Registration number if legal entity",
      "legalEntityGovLaw": "Governing law if legal entity",
      "remarks": ""
    }
  ]
}

Important notes:
1. Section 13 (Directors): extract ALL natural person and body corporate directors with appointment/cessation dates and service addresses
2. Section 14 / Schedule 1 (Members): extract shareholders with share class, number of shares held, and address
3. Part II / Register of Significant Controllers: extract all significant controllers with nature of control
4. Use null for empty dates of cessation when still active
5. Dates must be YYYY-MM-DD
6. Only include people/entities with filled names — skip empty template rows
7. For partially redacted HKID, include visible digits (e.g. Z739)`,
    },
    {
      type: 'text',
      text: [
        `File: ${file.fileName}`,
        file.images.length > 0 ? `PDF rendered pages: ${file.images.map(image => image.label).join(', ')}` : '',
        file.text ? `Extracted PDF text:\n${file.text.slice(0, MAX_TEXT_CHARS)}` : '',
      ].filter(Boolean).join('\n'),
    },
  ]

  if (file.images.length > 0) {
    for (const image of file.images) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      })
    }
  } else if (file.mimeType.startsWith('image/')) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
    })
  }

  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  })

  if (!res.ok) {
    throw new Error(`Bailian API returned ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string') {
    return { directors: [], members: [], significantControllers: [], source: 'bailian' }
  }

  return normalizeAnalysis(parseJsonObject(raw))
}

function fallbackAnalyze(file: PreparedFile): NAR1AnalysisResult {
  const text = file.text

  // Basic regex extraction as fallback
  const directors: NAR1DirectorInfo[] = []
  const members: NAR1MemberInfo[] = []
  const significantControllers: NAR1ControllerInfo[] = []

  // Try to extract company info
  const companyNameEn = extractCompanyName(text)
  const companyNumber = extractCompanyNumber(text)

  // Extract directors using common patterns
  const directorMatches = text.matchAll(
    /(?:Director|董事)[\s\S]{0,200}?(?:Name|姓名)[\s:\n]+([A-Z\s]+)(?:[\s\S]{0,100}?(?:ID|身份證|Passport)[\s:\n]+([A-Z0-9\(\)]+))?/gi
  )
  for (const match of directorMatches) {
    if (match[1]) {
      directors.push({
        nameEn: match[1].trim(),
        idNumber: match[2]?.trim(),
        isReserveDirector: text.toLowerCase().includes('reserve'),
      })
    }
  }

  return {
    companyNameEn,
    companyNumber,
    directors,
    members,
    significantControllers,
    source: 'fallback',
  }
}

function normalizeAnalysis(value: unknown): NAR1AnalysisResult {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}

  const directors = normalizeArray(record['directors']).map(normalizeDirector).filter(d => d.nameEn)
  const members = normalizeArray(record['members']).map(normalizeMember).filter(m => m.nameEn)
  const controllers = normalizeArray(record['significantControllers']).map(normalizeController).filter(c => c.nameEn)

  return {
    companyNameEn: cleanString(record['companyNameEn']),
    companyNameZh: cleanString(record['companyNameZh']),
    companyNumber: cleanString(record['companyNumber']),
    annualReturnDate: normalizeDate(cleanString(record['annualReturnDate'])),
    directors,
    members,
    significantControllers: controllers,
    source: 'bailian',
  }
}

function normalizeDirector(value: unknown): NAR1DirectorInfo {
  if (!value || typeof value !== 'object') {
    return { nameEn: '', isReserveDirector: false, dateOfCessation: null }
  }
  const record = value as Record<string, unknown>

  const idType = cleanString(record['idType'])
  const validIdType = idType === 'HKID' || idType === 'PASSPORT' || idType === 'OTHER'
    ? idType
    : undefined

  return {
    nameEn: cleanString(record['nameEn']) || '',
    nameZh: cleanString(record['nameZh']) || cleanString(record['nameCn']) || undefined,
    idType: validIdType,
    idNumber: cleanString(record['idNumber']) || undefined,
    nationality: cleanString(record['nationality']) || undefined,
    addressForService: cleanString(record['addressForService']) || cleanString(record['address']) || undefined,
    dateOfAppointment: normalizeDate(cleanString(record['dateOfAppointment'])) || undefined,
    dateAsReserve: normalizeDate(cleanString(record['dateAsReserve'])) || undefined,
    dateOfCessation: normalizeDate(cleanString(record['dateOfCessation'])) || null,
    dateOfBirth: normalizeDate(cleanString(record['dateOfBirth'])) || undefined,
    placeOfBirth: cleanString(record['placeOfBirth']) || undefined,
    countryOfIssuance: cleanString(record['countryOfIssuance']) || cleanString(record['issuingCountry']) || undefined,
    isReserveDirector: Boolean(record['isReserveDirector']),
    isCorporation: Boolean(record['isCorporation']),
    corpRegNumber: cleanString(record['corpRegNumber']) || cleanString(record['legalEntityRegNo']) || undefined,
    corpRegPlace: cleanString(record['corpRegPlace']) || undefined,
  }
}

function normalizeMember(value: unknown): NAR1MemberInfo {
  if (!value || typeof value !== 'object') {
    return { nameEn: '', isTransferred: false }
  }
  const record = value as Record<string, unknown>

  return {
    nameEn: cleanString(record['nameEn']) || '',
    nameZh: cleanString(record['nameZh']) || cleanString(record['nameCn']) || undefined,
    registeredAddress: cleanString(record['registeredAddress']) || cleanString(record['address']) || undefined,
    shareClass: cleanString(record['shareClass']) || undefined,
    sharesHeld: typeof record['sharesHeld'] === 'number'
      ? record['sharesHeld']
      : parseShareCount(cleanString(record['sharesHeld'])),
    occupation: cleanString(record['occupation']) || undefined,
    idNumber: cleanString(record['idNumber']) || undefined,
    becomingDate: normalizeDate(cleanString(record['becomingDate'])) || undefined,
    isTransferred: Boolean(record['isTransferred']),
  }
}

function normalizeController(value: unknown): NAR1ControllerInfo {
  if (!value || typeof value !== 'object') {
    return { nameEn: '', isLegalEntity: false }
  }
  const record = value as Record<string, unknown>

  const idType = cleanString(record['idType'])
  const validIdType = idType === 'HKID' || idType === 'PASSPORT' || idType === 'OTHER'
    ? idType
    : undefined

  const idNumber = cleanString(record['idNumber']) || cleanString(record['idPassportNo'])

  return {
    nameEn: cleanString(record['nameEn']) || '',
    nameZh: cleanString(record['nameZh']) || cleanString(record['nameCn']) || undefined,
    idType: validIdType,
    idNumber,
    idPassportNo: idNumber,
    issuingCountry: cleanString(record['issuingCountry']) || undefined,
    correspondenceAddress: cleanString(record['correspondenceAddress']) || undefined,
    natureOfControl: cleanString(record['natureOfControl']) || undefined,
    entryDate: normalizeDate(cleanString(record['entryDate'])) || undefined,
    becomingDate: normalizeDate(cleanString(record['becomingDate'])) || undefined,
    cessationDate: normalizeDate(cleanString(record['cessationDate'])) || undefined,
    isLegalEntity: Boolean(record['isLegalEntity']),
    legalEntityRegNo: cleanString(record['legalEntityRegNo']) || undefined,
    legalEntityGovLaw: cleanString(record['legalEntityGovLaw']) || undefined,
    remarks: cleanString(record['remarks']) || undefined,
  }
}

function normalizeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return []
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.trim().replace(/\s+/g, ' ')
  return cleaned || undefined
}

function parseShareCount(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = value.match(/(\d[\d,]*)/)
  if (!match) return undefined
  const n = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw || raw.toLowerCase() === 'null') return undefined

  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`

  return raw || undefined
}

function extractCompanyName(text: string): string | undefined {
  const match = text.match(/(?:Company Name|公司名稱)[\s:\n]+([A-Z][A-Z\s&.,'-]+LIMITED)/i)
  return match?.[1]?.trim()
}

function extractCompanyNumber(text: string): string | undefined {
  const match = text.match(/(?:Company Number|公司編號|公司编号)[\s:\n]+(\d{6,10})/i)
  return match?.[1]?.trim()
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try {
      return JSON.parse(match[0])
    } catch {
      return {}
    }
  }
}

function guessMimeType(fileName: string) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

/** UI shape used by admin company detail NAR1 preview modal */
export type NAR1UiAnalysisResult = {
  directors: Array<{
    nameEn: string
    nameZh?: string
    dateOfAppointment?: string
    dateAsReserve?: string
    addressForService: string
    nationality?: string
    idType?: string
    idNumber?: string
    dateOfBirth?: string
    placeOfBirth?: string
    countryOfIssuance?: string
    isCorporation?: boolean
    corpRegNumber?: string
    corpRegPlace?: string
    status: 'appointed' | 'resigned' | 'active'
    cessationDate?: string
    matchedKeyPersonId?: string
  }>
  members: Array<{
    nameEn: string
    nameZh?: string
    address: string
    shareClass?: string
    sharesHeld?: number
    occupation?: string
    idNumber?: string
    becomingDate?: string
    cessationDate?: string
    status: 'active' | 'resigned'
    matchedKeyPersonId?: string
  }>
  significantControllers: Array<{
    nameEn: string
    nameZh?: string
    entryDate?: string
    correspondenceAddress?: string
    natureOfControl: string
    becomingDate?: string
    cessationDate?: string
    idType?: string
    idPassportNo?: string
    issuingCountry?: string
    isLegalEntity?: boolean
    legalEntityRegNo?: string
    legalEntityGovLaw?: string
    remarks?: string
    matchedKeyPersonId?: string
  }>
}

export function mapNAR1AnalysisForUi(result: NAR1AnalysisResult): NAR1UiAnalysisResult {
  return {
    directors: result.directors.map(director => ({
      nameEn: director.nameEn,
      nameZh: director.nameZh,
      dateOfAppointment: director.dateOfAppointment,
      dateAsReserve: director.dateAsReserve,
      addressForService: director.addressForService ?? '',
      nationality: director.nationality,
      idType: director.idType,
      idNumber: director.idNumber,
      dateOfBirth: director.dateOfBirth,
      placeOfBirth: director.placeOfBirth,
      countryOfIssuance: director.countryOfIssuance,
      isCorporation: director.isCorporation,
      corpRegNumber: director.corpRegNumber,
      corpRegPlace: director.corpRegPlace,
      status: director.dateOfCessation ? 'resigned' : 'active',
      cessationDate: director.dateOfCessation ?? '',
    })),
    members: result.members.map(member => ({
      nameEn: member.nameEn,
      nameZh: member.nameZh,
      address: member.registeredAddress ?? '',
      shareClass: member.shareClass,
      sharesHeld: member.sharesHeld,
      occupation: member.occupation,
      idNumber: member.idNumber,
      becomingDate: member.becomingDate ?? '',
      cessationDate: member.isTransferred ? '' : '',
      status: member.isTransferred ? 'resigned' : 'active',
    })),
    significantControllers: result.significantControllers.map(controller => ({
      nameEn: controller.nameEn,
      nameZh: controller.nameZh,
      entryDate: controller.entryDate ?? controller.becomingDate,
      correspondenceAddress: controller.correspondenceAddress ?? '',
      natureOfControl: controller.natureOfControl ?? '',
      becomingDate: controller.becomingDate,
      cessationDate: controller.cessationDate ?? '',
      idType: controller.idType,
      idPassportNo: controller.idPassportNo ?? controller.idNumber,
      issuingCountry: controller.issuingCountry,
      isLegalEntity: controller.isLegalEntity,
      legalEntityRegNo: controller.legalEntityRegNo,
      legalEntityGovLaw: controller.legalEntityGovLaw,
      remarks: controller.remarks,
    })),
  }
}

export async function analyzeNAR1FromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
): Promise<NAR1AnalysisResult> {
  const type = mimeType ?? guessMimeType(fileName)
  const file = new File([new Uint8Array(buffer)], fileName, { type })
  return analyzeNAR1Document(file)
}
