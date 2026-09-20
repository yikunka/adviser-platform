import { renderBoardMinutes } from '@/lib/work-tasks/board-minutes-docx'
import type { AccountingExtensionReason, AccountingReferenceInput } from '@/lib/work-tasks/company-record-change'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const REASON: Record<Exclude<AccountingExtensionReason, ''>, string> = {
  NONE_IN_FIVE_YEARS: ', on the ground that this accounting reference date has not been specified within the previous five years',
  HOLDING_COMPANY: ", on the ground that the new accounting reference date coincides with the accounting reference date of the Company's holding company",
  MEMBERS_RESOLUTION: ', on the ground that the extension is approved by a resolution of the members',
}

function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const monthName = MONTHS[(month ?? 0) - 1] ?? ''
  return `${day || ''} ${monthName} ${year || ''}`.trim()
}

function memberNames(input: AccountingReferenceInput): string[] {
  return input.memberNames.map(name => name.trim()).filter(Boolean).slice(0, 4)
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function paragraphStart(xml: string, indexInside: number): number {
  return Math.max(xml.lastIndexOf('<w:p ', indexInside), xml.lastIndexOf('<w:p>', indexInside))
}

function paragraphBounds(xml: string, indexInside: number): { start: number; end: number } | null {
  if (indexInside < 0) return null
  const start = paragraphStart(xml, indexInside)
  const close = xml.indexOf('</w:p>', indexInside)
  if (start < 0 || close < 0) return null
  return { start, end: close + '</w:p>'.length }
}

function signatureSpacer(): string {
  return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>'.repeat(3)
}

function signatureParagraph(text: string, spacing: { before?: string; after: string }): string {
  const rPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>'
  const before = spacing.before ? ` w:before="${spacing.before}"` : ''
  return `<w:p><w:pPr><w:spacing${before} w:after="${spacing.after}" w:line="240" w:lineRule="auto"/>${rPr}</w:pPr><w:r>${rPr}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`
}

function signatureCell(name: string, before?: string): string {
  return `<w:tc><w:tcPr><w:tcW w:w="4706" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${signatureParagraph('_______________________________', { before, after: '40' })}${signatureParagraph(name, { after: '40' })}${signatureParagraph('(Member)', { after: '120' })}</w:tc>`
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

/** One present line and one closing signature per named member. A single member keeps the template layout. */
function applyMemberSignatures(xml: string, names: string[]): string {
  if (names.length <= 1) return xml
  const present = paragraphBounds(xml, xml.indexOf('(signature)'))
  if (!present) throw new Error('会计参照日会议纪录缺少出席签名位置。')
  const presentXml = xml.slice(present.start, present.end)
  const presentLines = names.map(name => signatureSpacer() + presentXml.replace('[Member Name]', escapeXml(name))).join('')
  xml = xml.slice(0, present.start) + presentLines + xml.slice(present.end)

  const line = paragraphBounds(xml, xml.indexOf('_______________________________'))
  if (!line) throw new Error('会计参照日会议纪录缺少签署位置。')
  const name = paragraphBounds(xml, xml.indexOf('[Member Name]', line.end))
  const role = name ? paragraphBounds(xml, xml.indexOf('(Member)', name.end)) : null
  if (!name || !role) throw new Error('会计参照日会议纪录的成员签署位置无法读取。')
  return xml.slice(0, line.start) + signatureSpacer() + signatureTable(names) + xml.slice(role.end)
}

export async function renderAccountingReferenceMinutes(input: AccountingReferenceInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const members = memberNames(input)
  if (members.length === 0) throw new Error('会计参照日会议纪录需要至少一名成员。')
  const safeCompany = input.companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  const reason = input.change === 'EXTEND' && input.extensionReason ? REASON[input.extensionReason] : ''
  const buffer = await renderBoardMinutes({
    folder: 'accounting-reference',
    templateFile: 'Board Minutes - Accounting Reference Date.docx',
    missingMessage: '找不到会计参照日的成员会议纪录模板：Board Minutes - Accounting Reference Date.docx',
    omitChineseName: !input.companyNameZh.trim(),
    prepare: xml => applyMemberSignatures(xml, members),
    values: {
      '[BR No.]': (input.brn || input.companyNo).trim(),
      '[Company Name (English)]': input.companyNameEn.trim(),
      '[Company Name (Chinese)]': input.companyNameZh.trim(),
      '[Date]': longDate(input.resolutionDate),
      '[Member Name]': members[0],
      '[Current Period End]': longDate(input.currentPeriodEnd),
      '[New Period End]': longDate(input.newPeriodEnd),
      '[Change]': input.change === 'EXTEND' ? 'extended' : 'shortened',
      '[Reason]': reason,
    },
  })
  return {
    templateKey: 'board-minutes-ard',
    fileName: `Minutes of Members - Accounting Reference Date - ${safeCompany}.docx`.slice(0, 180),
    buffer,
  }
}
