import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import PizZip from 'pizzip'
import { fillBracketPlaceholders } from '@/lib/work-tasks/fill-docx'
import { REGISTER_ITEMS, type RegisterItemKey } from '@/lib/work-tasks/register-items'
import type { RegisterLocationInput } from '@/lib/work-tasks/company-record-change'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TEMPLATE_FILE = 'Board Minutes - Location of Registers.docx'

function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const monthName = MONTHS[(month ?? 0) - 1] ?? ''
  return `${day || ''} ${monthName} ${year || ''}`.trim()
}

function locationText(input: RegisterLocationInput): string {
  if (input.location === 'REGISTERED_OFFICE') return 'the registered office of the Company'
  const address = [input.flat, input.building, input.street, input.district].map(part => part.trim()).filter(Boolean)
  return address.length > 0 ? `${address.join(', ')}, Hong Kong` : 'the registered office of the Company'
}

function registerText(keys: RegisterItemKey[]): string {
  const selected = new Set(keys)
  return REGISTER_ITEMS
    .filter(item => selected.has(item.key))
    .map(item => item.en.startsWith('register') ? `the ${item.en}` : item.en)
    .join('; ')
}

function paragraphStart(xml: string, indexInside: number): number {
  return Math.max(xml.lastIndexOf('<w:p ', indexInside), xml.lastIndexOf('<w:p>', indexInside))
}

/** Three blank lines so there is room to sign above the line. */
function signatureSpacer(): string {
  return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>'.repeat(3)
}

function insertSpacerBefore(xml: string, token: string): string {
  const at = xml.indexOf(token)
  if (at < 0) return xml
  const paragraph = paragraphStart(xml, at)
  if (paragraph < 0) return xml
  return xml.slice(0, paragraph) + signatureSpacer() + xml.slice(paragraph)
}

function giveSignatureRoom(xml: string): string {
  const closing = '_______________________________'
  const closingWide = '_'.repeat(60)
  const present = '[Director Name]                                              _________________  (signature)'
  const presentWide = `[Director Name]${' '.repeat(12)}${'_'.repeat(40)}  (signature)`
  let next = xml.replace(closing, closingWide)
  next = insertSpacerBefore(next, closingWide)
  next = next.replace(present, presentWide)
  return insertSpacerBefore(next, presentWide)
}

function removeParagraphContaining(xml: string, token: string): string {
  const at = xml.indexOf(token)
  if (at < 0) return xml
  const start = paragraphStart(xml, at)
  const end = xml.indexOf('</w:p>', at)
  if (start < 0 || end < 0) return xml
  return xml.slice(0, start) + xml.slice(end + '</w:p>'.length)
}

async function resolveTemplate(): Promise<string> {
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/secretarial/register-location', TEMPLATE_FILE),
    path.join(/* turbopackIgnore: true */ process.cwd(), 'Secretarial Template', TEMPLATE_FILE),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try the next location
    }
  }
  throw new Error(`找不到登记册备存地点的董事会会议纪录模板：${TEMPLATE_FILE}`)
}

export async function renderRegisterLocationMinutes(input: RegisterLocationInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const zip = new PizZip(await readFile(await resolveTemplate()))
  const values = {
    '[BR No.]': (input.brn || input.companyNo).trim(),
    '[Company Name (English)]': input.companyNameEn.trim(),
    '[Company Name (Chinese)]': input.companyNameZh.trim(),
    '[Date]': longDate(input.signatoryDate),
    '[Director Name]': input.signatoryName.trim(),
    '[Location]': locationText(input),
    '[Effective Date]': longDate(input.effectiveDate),
    '[Registers]': registerText(input.registers),
  }
  const safeCompany = input.companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue
    const entry = zip.file(name)
    if (!entry) continue
    let xml = entry.asText()
    if (name === 'word/document.xml') {
      if (!input.companyNameZh.trim()) xml = removeParagraphContaining(xml, '[Company Name (Chinese)]')
      xml = giveSignatureRoom(xml)
    }
    if (!xml.includes('[')) {
      zip.file(name, xml)
      continue
    }
    zip.file(name, fillBracketPlaceholders(xml, values))
  }
  return {
    templateKey: 'board-minutes',
    fileName: `Board Minutes - Location of Registers - ${safeCompany}.docx`.slice(0, 180),
    buffer: zip.generate({ type: 'nodebuffer' }) as Buffer,
  }
}
