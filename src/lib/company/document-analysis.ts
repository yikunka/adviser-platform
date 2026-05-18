import { inflateSync, inflateRawSync } from 'zlib'
import { execFile } from 'child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'

export type CompanyDocumentType = 'CI' | 'BR' | 'AA' | 'OTHER'

export type CompanyDocumentAnalysisFields = {
  nameEn?: string
  nameZh?: string
  companyNumber?: string
  dateOfIncorporation?: string
  registeredAddress?: string
  businessNature?: string
}

export type CompanyDocumentAnalysisResult = {
  fields: CompanyDocumentAnalysisFields
  documents: Array<{
    fileName: string
    documentType: CompanyDocumentType
  }>
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
  documentType: CompanyDocumentType
}

const ANALYSIS_MODEL = 'qwen3.5-flash'
const MAX_TEXT_CHARS = 12000
const MAX_PDF_IMAGE_PAGES = 3
const execFileAsync = promisify(execFile)
const PDFTOPPM_CANDIDATES = [
  process.env['PDFTOPPM_PATH'] ?? '',
  'pdftoppm',
  '/opt/homebrew/bin/pdftoppm',
  '/usr/local/bin/pdftoppm',
  '/usr/bin/pdftoppm',
].filter(Boolean)

export function inferCompanyDocumentType(fileName: string): CompanyDocumentType {
  const normalized = fileName.toLowerCase()
  if (/\bci\b|certificate.*incorporation|incorporation.*certificate|公司註冊證書|公司注册证书/.test(normalized)) return 'CI'
  if (/\bbr\b|business.*registration|商業登記|商业登记/.test(normalized)) return 'BR'
  if (/\baa\b|articles|association|章程/.test(normalized)) return 'AA'
  return 'OTHER'
}

export async function analyzeCompanyDocuments(files: File[]): Promise<CompanyDocumentAnalysisResult> {
  const prepared = await Promise.all(files.map(prepareFile))
  const fallback = fallbackAnalyze(prepared)
  const apiKey = getBailianApiKey()

  if (!apiKey) return fallback

  try {
    const fields = await analyzeWithBailian(prepared, apiKey)
    return {
      fields: mergeFields(fallback.fields, fields),
      documents: prepared.map(file => ({
        fileName: file.fileName,
        documentType: fieldsToDocType(file.documentType),
      })),
      source: 'bailian',
    }
  } catch (error) {
    console.error('[company/document-analysis] Bailian analysis failed:', error)
    return fallback
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
    documentType: inferCompanyDocumentType(file.name),
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

async function analyzeWithBailian(files: PreparedFile[], apiKey: string): Promise<CompanyDocumentAnalysisFields> {
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        'Extract Hong Kong company profile fields from the attached company documents.',
        'Return strict JSON only with this shape:',
        '{"nameEn":"","nameZh":"","companyNumber":"","dateOfIncorporation":"YYYY-MM-DD","registeredAddress":"","businessNature":""}',
        'Leave unknown fields as empty strings. Prefer Certificate of Incorporation for company name, company number, and incorporation date. Prefer Business Registration for registered address and business nature.',
      ].join('\n'),
    },
  ]

  for (const file of files) {
    content.push({
      type: 'text',
      text: [
        `File: ${file.fileName}`,
        `Likely document type: ${file.documentType}`,
        file.images.length > 0 ? `PDF rendered pages: ${file.images.map(image => image.label).join(', ')}` : '',
        file.text ? `Extracted PDF text:\n${file.text.slice(0, MAX_TEXT_CHARS)}` : '',
      ].filter(Boolean).join('\n'),
    })
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
  if (typeof raw !== 'string') return {}

  return normalizeFields(parseJsonObject(raw))
}

function fallbackAnalyze(files: PreparedFile[]): CompanyDocumentAnalysisResult {
  const allText = files.map(file => `${file.fileName}\n${file.text}`).join('\n\n')
  const fields = normalizeFields({
    companyNumber: firstMatch(allText, [
      /(?:company\s*(?:no\.?|number)|公司編號|公司编号)\s*[:：]?\s*([0-9]{6,10})/i,
      /\b([0-9]{7,8})\b/,
    ]),
    dateOfIncorporation: normalizeDate(firstMatch(allText, [
      /(?:date\s*of\s*incorporation|成立日期|註冊日期|注册日期)\s*[:：]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}|[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2})/i,
    ])),
    nameEn: firstMatch(allText, [
      /([A-Z0-9][A-Z0-9&.,'\-\s]{2,180}\s+LIMITED)\b/,
      /([A-Z0-9][A-Z0-9&.,'\-\s]{2,180}\s+LTD\.?)\b/,
    ]),
  })

  return {
    fields,
    documents: files.map(file => ({
      fileName: file.fileName,
      documentType: fieldsToDocType(file.documentType),
    })),
    source: 'fallback',
  }
}

function normalizeFields(value: unknown): CompanyDocumentAnalysisFields {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    nameEn: clean(record['nameEn']),
    nameZh: clean(record['nameZh']),
    companyNumber: clean(record['companyNumber']),
    dateOfIncorporation: normalizeDate(clean(record['dateOfIncorporation'])),
    registeredAddress: clean(record['registeredAddress']),
    businessNature: clean(record['businessNature']),
  }
}

function mergeFields(base: CompanyDocumentAnalysisFields, incoming: CompanyDocumentAnalysisFields) {
  return Object.fromEntries(
    Object.entries({ ...base, ...incoming }).filter(([, value]) => typeof value === 'string' && value.trim()),
  ) as CompanyDocumentAnalysisFields
}

function fieldsToDocType(type: CompanyDocumentType): CompanyDocumentType {
  return type === 'OTHER' ? 'OTHER' : type
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : undefined
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return undefined
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const raw = value.trim()
  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return undefined
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
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
  const dir = await mkdtemp(path.join(tmpdir(), 'company-pdf-'))
  const inputPath = path.join(dir, 'input.pdf')
  const outputPrefix = path.join(dir, 'page')

  try {
    await writeFile(inputPath, buffer)
    const rendered = await renderWithPdftoppm(inputPath, outputPrefix)
      || await renderWithQuickLook(inputPath, dir)

    if (!rendered) {
      console.warn(`[company/document-analysis] PDF image render skipped for ${fileName}: no PDF renderer found`)
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
        console.warn(`[company/document-analysis] pdftoppm failed at ${command}:`, error)
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
      console.warn('[company/document-analysis] qlmanage PDF render failed:', error)
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
