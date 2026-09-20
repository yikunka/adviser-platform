import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import PizZip from 'pizzip'
import { fillBracketPlaceholders, type PlaceholderValue } from '@/lib/work-tasks/fill-docx'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export type CompanyNameChangeSignatory = 'DIRECTOR' | 'COMPANY_SECRETARY'

export type CompanyNameChangeInput = {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  newCompanyNameEn: string
  newCompanyNameZh: string
  changeDate: string
  shareholderNames: string[]
  signatoryName: string
  signatoryCapacity: CompanyNameChangeSignatory
  signatoryDate: string
  presentorNameZh: string
  presentorNameEn: string
  presentorAddress: string
  presentorTel: string
  presentorFax: string
  presentorEmail: string
  presentorReference: string
}

export function companyNameChangeShareholders(names: string[]): string[] {
  return names.map(name => name.trim()).filter(Boolean).slice(0, 4)
}

export function companyNameChangePlaceholders(input: CompanyNameChangeInput): Record<string, PlaceholderValue> {
  const [year, month, day] = input.changeDate.split('-').map(Number)
  const monthName = MONTHS[month - 1] ?? ''
  return {
    '[Company Name (English)]': input.companyNameEn,
    '[Company Name (Chinese)]': input.companyNameZh,
    '[Company No.]': input.companyNo,
    '[Date]': `${day} ${monthName} ${year}`,
    '[New Company Name (English)]': input.newCompanyNameEn,
    '[New Company Name (Chinese)]': input.newCompanyNameZh,
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function paragraphStart(xml: string, indexInside: number): number {
  return Math.max(xml.lastIndexOf('<w:p ', indexInside), xml.lastIndexOf('<w:p>', indexInside))
}

function removeParagraphContaining(xml: string, token: string): string {
  const at = xml.indexOf(token)
  if (at < 0) return xml
  const start = paragraphStart(xml, at)
  const end = xml.indexOf('</w:p>', at)
  if (start < 0 || end < 0) return xml
  return xml.slice(0, start) + xml.slice(end + '</w:p>'.length)
}

function signatureParagraph(text: string, spacing: { before?: string; after: string }): string {
  const rPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>'
  const before = spacing.before ? ` w:before="${spacing.before}"` : ''
  return `<w:p><w:pPr><w:spacing${before} w:after="${spacing.after}" w:line="240" w:lineRule="auto"/>${rPr}</w:pPr><w:r>${rPr}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`
}

/** Three blank lines so the signature block sits below the resolution text. */
function signatureSpacer(): string {
  return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>'.repeat(3)
}

function signatureCell(name: string, before?: string): string {
  return `<w:tc><w:tcPr><w:tcW w:w="4706" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${signatureParagraph('_______________________________', { before, after: '40' })}${signatureParagraph(name, { after: '40' })}${signatureParagraph('(Shareholder)', { after: '120' })}</w:tc>`
}

function signatureTable(names: string[]): string {
  const rows: string[] = []
  for (let index = 0; index < names.length; index += 2) {
    const before = index === 0 ? undefined : '280'
    const cells = names.slice(index, index + 2).map(name => signatureCell(name, before)).join('')
    rows.push(`<w:tr>${cells}</w:tr>`)
  }
  return `<w:tbl><w:tblPr><w:tblW w:w="9412" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4706"/><w:gridCol w:w="4706"/></w:tblGrid>${rows.join('')}</w:tbl>`
}

/** Replaces the template's four signature slots with one block per named shareholder. */
export function applyShareholderSignatures(xml: string, names: string[]): string {
  const shareholders = companyNameChangeShareholders(names)
  const markerAt = xml.indexOf('[Shareholder Name 1]')
  const endMarkerAt = xml.indexOf('[Shareholder Name 4]')
  if (markerAt < 0 || endMarkerAt < 0) {
    throw new Error('公司名称变更模板缺少股东签名位置。')
  }
  const nameParaStart = paragraphStart(xml, markerAt)
  const lineParaStart = paragraphStart(xml, nameParaStart - 1)
  let blockStart = lineParaStart
  for (let i = 0; i < 2; i++) {
    const prev = paragraphStart(xml, blockStart - 1)
    if (prev < 0) break
    const prevEnd = xml.indexOf('</w:p>', prev)
    if (prevEnd < 0 || prevEnd > blockStart) break
    if (xml.slice(prev, prevEnd).includes('<w:t')) break
    blockStart = prev
  }
  const name4End = xml.indexOf('</w:p>', endMarkerAt)
  const labelEnd = xml.indexOf('</w:p>', name4End + '</w:p>'.length)
  if (lineParaStart < 0 || name4End < 0 || labelEnd < 0) {
    throw new Error('公司名称变更模板的股东签名位置无法读取。')
  }
  const after = labelEnd + '</w:p>'.length
  const signatures = shareholders.length > 0 ? signatureSpacer() + signatureTable(shareholders) : ''
  return xml.slice(0, blockStart) + signatures + xml.slice(after)
}

async function resolveTemplate(): Promise<string> {
  const fileName = 'Special Resolution - Change of Company Name.docx'
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/secretarial/company-name-change', fileName),
    path.join(/* turbopackIgnore: true */ process.cwd(), 'Secretarial Template', fileName),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try the next location
    }
  }
  throw new Error(`找不到公司名称变更模板：${fileName}`)
}

export async function renderCompanyNameChangeDocument(input: CompanyNameChangeInput) {
  const templatePath = await resolveTemplate()
  const zip = new PizZip(await readFile(templatePath))
  const values = companyNameChangePlaceholders(input)
  const shareholders = companyNameChangeShareholders(input.shareholderNames)
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue
    const entry = zip.file(name)
    if (!entry) continue
    let xml = entry.asText()
    if (name === 'word/document.xml') {
      xml = applyShareholderSignatures(xml, shareholders)
      if (!input.companyNameZh.trim()) xml = removeParagraphContaining(xml, '[Company Name (Chinese)]')
      if (!input.newCompanyNameZh.trim()) xml = removeParagraphContaining(xml, '[New Company Name (Chinese)]')
    }
    if (!xml.includes('[')) {
      if (xml !== entry.asText()) zip.file(name, xml)
      continue
    }
    zip.file(name, fillBracketPlaceholders(xml, values))
  }
  const buffer = zip.generate({ type: 'nodebuffer' }) as Buffer
  const safeCompany = input.companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  return {
    templateKey: 'special-resolution',
    fileName: `特别决议-更改公司名称 - ${safeCompany}.docx`.slice(0, 180),
    buffer,
  }
}
