import { inflateSync, inflateRawSync } from 'zlib'
import { execFile } from 'child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'

export type NAR1DirectorInfo = {
  nameEn: string
  nameZh?: string
  idType?: 'HKID' | 'PASSPORT' | 'OTHER'
  idNumber?: string
  nationality?: string
  addressForService?: string
  dateOfAppointment?: string
  dateOfCessation?: string | null
  isReserveDirector?: boolean
}

export type NAR1MemberInfo = {
  nameEn: string
  nameZh?: string
  registeredAddress?: string
  shareClass?: string
  sharesHeld?: number
  isTransferred?: boolean
}

export type NAR1ControllerInfo = {
  nameEn: string
  nameZh?: string
  idType?: 'HKID' | 'PASSPORT' | 'OTHER'
  idNumber?: string
  issuingCountry?: string
  correspondenceAddress?: string
  natureOfControl?: string
  becomingDate?: string
  isLegalEntity?: boolean
  legalEntityRegNo?: string
  legalEntityGovLaw?: string
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
const MAX_PDF_IMAGE_PAGES = 5
const execFileAsync = promisify(execFile)
const PDFTOPPM_CANDIDATES = [
  process.env['PDFTOPPM_PATH'] ?? '',
  'pdftoppm',
  '/opt/homebrew/bin/pdftoppm',
  '/usr/local/bin/pdftoppm',
  '/usr/bin/pdftoppm',
].filter(Boolean)

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
    ? extractPdfText(bytes)
    : ''
  const images = mimeType === 'application/pdf'
    ? await renderPdfPages(bytes, file.name)
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
      text: `You are analyzing a Hong Kong Annual Return (NAR1) document. Extract the following information and return strict JSON only.

Return JSON with this exact structure:
{
  "companyNameEn": "Company Name in English",
  "companyNameZh": "公司中文名稱 (if available)",
  "companyNumber": "1234567",
  "annualReturnDate": "YYYY-MM-DD",
  "directors": [
    {
      "nameEn": "Director English Name",
      "nameZh": "董事中文名 (if available)",
      "idType": "HKID|PASSPORT|OTHER",
      "idNumber": "ID number",
      "nationality": "Nationality",
      "addressForService": "Service address",
      "dateOfAppointment": "YYYY-MM-DD",
      "dateOfCessation": "YYYY-MM-DD or null",
      "isReserveDirector": false
    }
  ],
  "members": [
    {
      "nameEn": "Member English Name",
      "nameZh": "成員中文名 (if available)",
      "registeredAddress": "Address",
      "shareClass": "Ordinary/Preference/etc",
      "sharesHeld": 1000,
      "isTransferred": false
    }
  ],
  "significantControllers": [
    {
      "nameEn": "Controller English Name",
      "nameZh": "控制人中文名 (if available)",
      "idType": "HKID|PASSPORT|OTHER",
      "idNumber": "ID number",
      "issuingCountry": "Country",
      "correspondenceAddress": "Address",
      "natureOfControl": "Direct/Indirect control description",
      "becomingDate": "YYYY-MM-DD",
      "isLegalEntity": false,
      "legalEntityRegNo": "Registration number if legal entity",
      "legalEntityGovLaw": "Governing law if legal entity"
    }
  ]
}

Important notes:
1. For directors, identify both active directors and those who have ceased (dateOfCessation will be set)
2. For members/shareholders, extract all shareholders from the share capital structure section
3. For significant controllers, extract from Part II - Register of Significant Controllers section
4. Use null for dateOfCessation if the director is still active
5. ID types should be: HKID (Hong Kong ID), PASSPORT, or OTHER
6. Dates must be in YYYY-MM-DD format
7. If a field is not available, use empty string or null`,
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

  const directors = normalizeArray(record['directors']).map(normalizeDirector)
  const members = normalizeArray(record['members']).map(normalizeMember)
  const controllers = normalizeArray(record['significantControllers']).map(normalizeController)

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
    nameZh: cleanString(record['nameZh']) || undefined,
    idType: validIdType,
    idNumber: cleanString(record['idNumber']) || undefined,
    nationality: cleanString(record['nationality']) || undefined,
    addressForService: cleanString(record['addressForService']) || undefined,
    dateOfAppointment: normalizeDate(cleanString(record['dateOfAppointment'])) || undefined,
    dateOfCessation: normalizeDate(cleanString(record['dateOfCessation'])) || null,
    isReserveDirector: Boolean(record['isReserveDirector']),
  }
}

function normalizeMember(value: unknown): NAR1MemberInfo {
  if (!value || typeof value !== 'object') {
    return { nameEn: '', isTransferred: false }
  }
  const record = value as Record<string, unknown>

  return {
    nameEn: cleanString(record['nameEn']) || '',
    nameZh: cleanString(record['nameZh']) || undefined,
    registeredAddress: cleanString(record['registeredAddress']) || undefined,
    shareClass: cleanString(record['shareClass']) || undefined,
    sharesHeld: typeof record['sharesHeld'] === 'number' ? record['sharesHeld'] : undefined,
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

  return {
    nameEn: cleanString(record['nameEn']) || '',
    nameZh: cleanString(record['nameZh']) || undefined,
    idType: validIdType,
    idNumber: cleanString(record['idNumber']) || undefined,
    issuingCountry: cleanString(record['issuingCountry']) || undefined,
    correspondenceAddress: cleanString(record['correspondenceAddress']) || undefined,
    natureOfControl: cleanString(record['natureOfControl']) || undefined,
    becomingDate: normalizeDate(cleanString(record['becomingDate'])) || undefined,
    isLegalEntity: Boolean(record['isLegalEntity']),
    legalEntityRegNo: cleanString(record['legalEntityRegNo']) || undefined,
    legalEntityGovLaw: cleanString(record['legalEntityGovLaw']) || undefined,
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

async function renderPdfPages(buffer: Buffer, fileName: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nar1-pdf-'))
  const inputPath = path.join(dir, 'input.pdf')
  const outputPrefix = path.join(dir, 'page')

  try {
    await writeFile(inputPath, buffer)
    const rendered = await renderWithPdftoppm(inputPath, outputPrefix)
      || await renderWithQuickLook(inputPath, dir)

    if (!rendered) {
      console.warn(
        `[nar1-analysis] PDF image render skipped for ${fileName}: no PDF renderer found. ` +
        'Install poppler-utils (Linux: apt-get install -y poppler-utils) or set the PDFTOPPM_PATH env var.'
      )
      return []
    }

    const names = (await readdir(dir))
      .filter(name => /^page-\d+\.png$/.test(name) || /^input\.pdf\.png$/.test(name))
      .sort((a, b) => pageNumber(a) - pageNumber(b))
      .slice(0, MAX_PDF_IMAGE_PAGES)

    return Promise.all(names.map(async (name, index) => ({
      mimeType: 'image/png' as const,
      base64: (await readFile(path.join(dir, name))).toString('base64'),
      label: `page ${index + 1}`,
    })))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function renderWithPdftoppm(inputPath: string, outputPrefix: string) {
  const args = [
    '-png',
    '-f', '1',
    '-l', String(MAX_PDF_IMAGE_PAGES),
    '-r', '160',
    inputPath,
    outputPrefix,
  ]

  for (const command of PDFTOPPM_CANDIDATES) {
    try {
      if (command.includes('/')) await access(command)
      await execFileAsync(command, args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
      return true
    } catch (error) {
      if (!isMissingCommandError(error)) {
        console.warn(`[nar1-analysis] pdftoppm failed at ${command}:`, error)
        return false
      }
    }
  }

  return false
}

async function renderWithQuickLook(inputPath: string, outputDir: string) {
  try {
    await access('/usr/bin/qlmanage')
    await execFileAsync('/usr/bin/qlmanage', [
      '-t',
      '-s', '1800',
      '-o', outputDir,
      inputPath,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
    return true
  } catch (error) {
    if (!isMissingCommandError(error)) {
      console.warn('[nar1-analysis] qlmanage PDF render failed:', error)
    }
    return false
  }
}

function isMissingCommandError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT'
}

function pageNumber(fileName: string) {
  if (fileName === 'input.pdf.png') return 1
  return Number(fileName.match(/page-(\d+)\.png$/)?.[1] ?? 0)
}

function extractPdfText(buffer: Buffer) {
  const source = buffer.toString('latin1')
  const chunks: string[] = []

  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(match[1], 'latin1')
    const variants = [raw]
    try { variants.push(inflateSync(raw)) } catch {}
    try { variants.push(inflateRawSync(raw)) } catch {}
    for (const variant of variants) {
      const text = decodePdfStrings(variant.toString('latin1'))
      if (text) chunks.push(text)
    }
  }

  const direct = decodePdfStrings(source)
  if (direct) chunks.push(direct)

  return chunks.join('\n').replace(/\s+/g, ' ').slice(0, MAX_TEXT_CHARS)
}

function decodePdfStrings(input: string) {
  const values: string[] = []
  for (const match of input.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    values.push(unescapePdfString(match[1]))
  }
  for (const arrayMatch of input.matchAll(/\[((?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*)+)\]\s*TJ/g)) {
    for (const stringMatch of arrayMatch[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      values.push(unescapePdfString(stringMatch[0].slice(1, -1)))
    }
  }
  return values.join(' ')
}

function unescapePdfString(value: string) {
  return value
    .replace(/\\([nrtbf()\\])/g, (_all, ch: string) => {
      const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }
      return map[ch] ?? ch
    })
    .replace(/\\([0-7]{1,3})/g, (_all, octal: string) => String.fromCharCode(parseInt(octal, 8)))
}

/** UI shape used by admin company detail NAR1 preview modal */
export type NAR1UiAnalysisResult = {
  directors: Array<{
    nameEn: string
    nameZh?: string
    dateOfAppointment?: string
    addressForService: string
    nationality?: string
    idType?: string
    idNumber?: string
    status: 'appointed' | 'resigned' | 'active'
    cessationDate?: string
  }>
  members: Array<{
    nameEn: string
    nameZh?: string
    address: string
    capacity: string
    telFax?: string
    becomingDate?: string
    cessationDate?: string
    status: 'active' | 'resigned'
  }>
  significantControllers: Array<{
    nameEn: string
    nameZh?: string
    entryDate?: string
    correspondenceAddress?: string
    natureOfControl: string
    becomingDate?: string
    cessationDate?: string
    isLegalEntity?: boolean
    legalEntityRegNo?: string
    issuingCountry?: string
  }>
}

export function mapNAR1AnalysisForUi(result: NAR1AnalysisResult): NAR1UiAnalysisResult {
  return {
    directors: result.directors.map(director => ({
      nameEn: director.nameEn,
      nameZh: director.nameZh,
      dateOfAppointment: director.dateOfAppointment,
      addressForService: director.addressForService ?? '',
      nationality: director.nationality,
      idType: director.idType,
      idNumber: director.idNumber,
      status: director.dateOfCessation ? 'resigned' : 'active',
      cessationDate: director.dateOfCessation ?? '',
    })),
    members: result.members.map(member => ({
      nameEn: member.nameEn,
      nameZh: member.nameZh,
      address: member.registeredAddress ?? '',
      capacity: member.shareClass ?? (member.sharesHeld != null ? `${member.sharesHeld} shares` : ''),
      becomingDate: '',
      cessationDate: member.isTransferred ? '' : '',
      status: member.isTransferred ? 'resigned' : 'active',
    })),
    significantControllers: result.significantControllers.map(controller => ({
      nameEn: controller.nameEn,
      nameZh: controller.nameZh,
      entryDate: controller.becomingDate,
      correspondenceAddress: controller.correspondenceAddress ?? '',
      natureOfControl: controller.natureOfControl ?? '',
      becomingDate: controller.becomingDate,
      cessationDate: '',
      isLegalEntity: controller.isLegalEntity,
      legalEntityRegNo: controller.legalEntityRegNo,
      issuingCountry: controller.issuingCountry,
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
