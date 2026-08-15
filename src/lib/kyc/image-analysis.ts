import { inflateSync, inflateRawSync } from 'zlib'
import { execFile } from 'child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'
import {
  buildKycAnalysisPrompt,
  normalizeFullKycFields,
  type KycAnalyzeDocRole,
  type KycFullAnalysisFields,
} from '@/lib/kyc/kyc-full-analysis'

/** Alias kept for image-create callers. */
export type KycImageAnalysisFields = KycFullAnalysisFields

const KYC_IMAGE_MODEL = 'qwen3.5-flash'
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

export async function analyzeKycDocument(
  file: File,
  role: KycAnalyzeDocRole = 'GENERIC',
): Promise<KycFullAnalysisFields> {
  if (file.type === 'application/pdf') {
    return analyzeKycPdf(file, role)
  }
  return analyzeKycImage(file, role)
}

export async function analyzeKycImage(
  file: File,
  role: KycAnalyzeDocRole = 'GENERIC',
): Promise<KycFullAnalysisFields> {
  const apiKey = getBailianApiKey()
  if (!apiKey) return {}

  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'image/jpeg'

  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: KYC_IMAGE_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildKycAnalysisPrompt(role),
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${bytes.toString('base64')}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  })

  if (!res.ok) {
    throw new Error(`Bailian API returned ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  return typeof raw === 'string' ? normalizeFullKycFields(parseJsonObject(raw)) : {}
}

async function analyzeKycPdf(
  file: File,
  role: KycAnalyzeDocRole = 'GENERIC',
): Promise<KycFullAnalysisFields> {
  const apiKey = getBailianApiKey()
  if (!apiKey) return {}

  const bytes = Buffer.from(await file.arrayBuffer())
  const text = extractPdfText(bytes)
  const images = await renderPdfPages(bytes, file.name)

  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: [
        buildKycAnalysisPrompt(role),
        text ? `Extracted PDF text:\n${text.slice(0, MAX_TEXT_CHARS)}` : '',
      ].filter(Boolean).join('\n\n'),
    },
  ]

  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })
  }

  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: KYC_IMAGE_MODEL,
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
  return typeof raw === 'string' ? normalizeFullKycFields(parseJsonObject(raw)) : {}
}

function getBailianApiKey() {
  return (
    process.env['DASHSCOPE_API_KEY'] ??
    process.env['BAILIAN_API_KEY'] ??
    process.env['ALIYUN_BAILIAN_API_KEY'] ??
    ''
  ).trim()
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

async function renderPdfPages(buffer: Buffer, fileName: string) {
  const dir = await mkdtemp(path.join(tmpdir(), 'kyc-pdf-'))
  const inputPath = path.join(dir, 'input.pdf')
  const outputPrefix = path.join(dir, 'page')

  try {
    await writeFile(inputPath, buffer)
    const rendered = await renderWithPdftoppm(inputPath, outputPrefix)
      || await renderWithQuickLook(inputPath, dir)

    if (!rendered) {
      console.warn(
        `[kyc/image-analysis] PDF image render skipped for ${fileName}: no PDF renderer found. ` +
        'Install poppler-utils (Linux: apt-get install -y poppler-utils) or set the PDFTOPPM_PATH env var.'
      )
      return []
    }

    const names = (await readdir(dir))
      .filter(name => /^page-\d+\.png$/.test(name) || /^input\.pdf\.png$/.test(name))
      .sort((a, b) => pageNumber(a) - pageNumber(b))
      .slice(0, MAX_PDF_IMAGE_PAGES)

    return Promise.all(names.map(async (name) => ({
      mimeType: 'image/png' as const,
      base64: (await readFile(path.join(dir, name))).toString('base64'),
    })))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function renderWithPdftoppm(inputPath: string, outputPrefix: string) {
  const args = ['-png', '-f', '1', '-l', String(MAX_PDF_IMAGE_PAGES), '-r', '160', inputPath, outputPrefix]
  for (const command of PDFTOPPM_CANDIDATES) {
    try {
      if (command.includes('/')) await access(command)
      await execFileAsync(command, args, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
      return true
    } catch (error) {
      if (!isMissingCommandError(error)) {
        console.warn(`[kyc/image-analysis] pdftoppm failed at ${command}:`, error)
        return false
      }
    }
  }
  return false
}

async function renderWithQuickLook(inputPath: string, outputDir: string) {
  try {
    await access('/usr/bin/qlmanage')
    await execFileAsync('/usr/bin/qlmanage', ['-t', '-s', '1800', '-o', outputDir, inputPath], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    })
    return true
  } catch (error) {
    if (!isMissingCommandError(error)) {
      console.warn('[kyc/image-analysis] qlmanage PDF render failed:', error)
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
    try { variants.push(inflateSync(raw)) } catch { /* ignore */ }
    try { variants.push(inflateRawSync(raw)) } catch { /* ignore */ }
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
