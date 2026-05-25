/**
 * Parse business nature codes (001–099) from the official PDF and regenerate
 * src/lib/kyc/businessNatureOptions.ts.
 *
 * Only rows with numeric codes in the Code column are included; section headers
 * (A, B, C, …) and their descriptive paragraphs are skipped.
 *
 * Usage: node scripts/generate-business-nature-options.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function truncateChunk(chunk) {
  let t = chunk
  for (const re of [
    /\s[A-Z]\s+[\u4e00-\u9fff\uf900-\ufaff]/,
    /\sThis Industry\b/,
    /\s本[\u4e00-\u9fff\uf900-\ufaff]*行業/,
    /\s編碼\s+Code/,
  ]) {
    const idx = t.search(re)
    if (idx >= 0) t = t.slice(0, idx)
  }
  return t.trim()
}

function splitZhEn(chunk) {
  const t = truncateChunk(chunk)
  const parts = t.split(/\s{2,}/).map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const enIdx = parts.findIndex(p => /^[A-Z][A-Za-z(,]/.test(p))
    if (enIdx > 0) return { zh: parts.slice(0, enIdx).join(' '), en: parts.slice(enIdx).join(' ') }
    if (/^[A-Z]/.test(parts[1])) return { zh: parts[0], en: parts.slice(1).join(' ') }
  }
  const paren = t.match(/^(.+?\))\s+([A-Z].*)$/)
  if (paren) return { zh: paren[1].trim(), en: paren[2].trim() }
  const mixed = t.match(/^([\u4e00-\u9fff\uf900-\ufaff\s（）()、，．·\dA-Za-z]+?)\s+([A-Z][\s\S]*)$/)
  if (mixed) return { zh: mixed[1].trim(), en: mixed[2].trim() }
  return { zh: t, en: '' }
}

function parseBusinessNatureText(text) {
  const cleaned = text
    .replace(/編碼\s+Code\s+描述\s+Description/g, ' ')
    .replace(/注意 Note[\s\S]*$/g, ' ')
    .trim()

  const re = /\b(\d{3})\s{2,}/g
  const hits = []
  let m
  while ((m = re.exec(cleaned)) !== null) {
    const n = parseInt(m[1], 10)
    if (n < 1 || n > 99) continue
    hits.push({ code: m[1], contentStart: m.index + m[0].length, index: m.index })
  }

  const items = []
  for (let i = 0; i < hits.length; i++) {
    const { code, contentStart } = hits[i]
    const tail = cleaned.slice(contentStart, i + 1 < hits.length ? hits[i + 1].index : cleaned.length)
    const { zh, en } = splitZhEn(tail)
    if (!zh || !en) {
      throw new Error(`Failed to parse code ${code}: zh=${JSON.stringify(zh)} en=${JSON.stringify(en)}`)
    }
    items.push({ code, zh, en })
  }
  return items
}

async function extractPdfText(pdfPath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(it => it.str).join(' ') + '\n'
  }
  return text
}

function toOptions(items) {
  return items.map(({ code, zh, en }) => ({
    code,
    zh,
    en,
    value: `${code} - ${en}`,
    label: `${code} ${zh} / ${en}`,
  }))
}

function emitTs(options) {
  const lines = options.map(o =>
    `  { code: ${JSON.stringify(o.code)}, zh: ${JSON.stringify(o.zh)}, en: ${JSON.stringify(o.en)}, value: ${JSON.stringify(o.value)}, label: ${JSON.stringify(o.label)} },`,
  )
  return `/** Auto-generated from businessnature PDF — run: node scripts/generate-business-nature-options.mjs */\n\nexport const BUSINESS_NATURE_OPTIONS = [\n${lines.join('\n')}\n] as const\n\nexport type BusinessNatureOption = (typeof BUSINESS_NATURE_OPTIONS)[number]\n`
}

const pdfCandidates = [
  path.join(root, 'scripts/data/businessnature.pdf'),
  path.join(root, '../PRD_DOC/businessnature(2).pdf'),
  '/Users/yibing/coding/Adviser/PRD_DOC/businessnature(2).pdf',
]

const pdfPath = pdfCandidates.find(p => fs.existsSync(p))
if (!pdfPath) {
  console.error('PDF not found. Expected one of:\n' + pdfCandidates.map(p => `  - ${p}`).join('\n'))
  process.exit(1)
}

const text = await extractPdfText(pdfPath)
const items = parseBusinessNatureText(text)
const options = toOptions(items)
const out = path.join(root, 'src/lib/kyc/businessNatureOptions.ts')
fs.writeFileSync(out, emitTs(options))
console.log(`Wrote ${options.length} options to ${out}`)
console.log(`Source: ${pdfPath}`)
