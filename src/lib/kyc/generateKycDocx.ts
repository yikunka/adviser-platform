import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle,
  WidthType, VerticalAlign, PageBreak,
} from 'docx'
import type { IRunOptions } from 'docx'
import type { KeyPerson } from '@prisma/client'

const cellM = { top: 70, bottom: 70, left: 90, right: 90 }
const kycBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const kycBorders = { top: kycBorder, bottom: kycBorder, left: kycBorder, right: kycBorder }
const CHECK = '☑'
const EMPTY = '□'

function d(v: unknown) {
  if (v == null) return '—'
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (Array.isArray(v)) return v.filter(Boolean).join(', ') || '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v) || '—'
}

function dDate(v: unknown) {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleDateString('en-HK')
  const date = new Date(String(v))
  return Number.isNaN(date.getTime()) ? String(v) : date.toLocaleDateString('en-HK')
}

function checkedWhen(value: boolean) {
  return value ? CHECK : EMPTY
}

function includesAny(values: string[] | null | undefined, needles: string[]) {
  const haystack = (values ?? []).join('\n').toLowerCase()
  return needles.some(needle => haystack.includes(needle.toLowerCase()))
}

function pText(text: string, opts: Partial<IRunOptions> = {}) {
  const children = text.split('\n').flatMap((line, i) => [
    ...(i > 0 ? [new TextRun({ break: 1, ...opts })] : []),
    new TextRun({ text: line, ...opts }),
  ])
  return new Paragraph({ children, spacing: { before: 0, after: 0 } })
}

function kycCell(text: string, width: number, span?: number, bold = false) {
  return new TableCell({
    borders: kycBorders,
    margins: cellM,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    ...(span && span > 1 ? { columnSpan: span } : {}),
    children: [pText(text, { size: 17, bold })],
  })
}

function sectionCell(text: string, width: number, span: number) {
  return kycCell(text, width, span, true)
}

function titleOptions(titlePrefix: string | null | undefined) {
  const t = (titlePrefix ?? '').toLowerCase()
  return `${checkedWhen(t.includes('mr'))}Mr. 先生  ${checkedWhen(t.includes('ms') || t.includes('miss'))} Ms. 小姐/女士  ${checkedWhen(t.includes('mrs'))} Mrs. 太太`
}

function personToRowLabelMap(p: KeyPerson) {
  return {
    titlePrefix: d(p.titlePrefix),
    nameEn: d(p.nameEn),
    nameZh: d(p.nameZh),
    idType: d(p.idType),
    idNumber: d(p.idNumber),
    placeOfIssue: d(p.placeOfIssue),
    placeOfBirth: d(p.placeOfBirth),
    idExpiryDate: d(p.idExpiryDate),
    dateOfBirth: d(p.dateOfBirth),
    nationality: d(p.nationality),
    homeAddress: d(p.homeAddress),
    contactAddress: d(p.contactAddress),
    homePhone: d(p.homePhone),
    workPhone: d(p.workPhone),
    mobile: d(p.mobile),
    wechat: d(p.wechat),
    email: d(p.email),
    isUsCitizen: p.isUsCitizen == null ? '—' : p.isUsCitizen ? 'Yes' : 'No',
    isPep: p.isPep == null ? '—' : p.isPep ? 'Yes' : 'No',
    emergencyContact: d(p.emergencyContact),
    employmentStatus: d(p.employmentStatus),
    employerName: d(p.employerName),
    employerAddress: d(p.employerAddress),
    businessNatures: d(p.businessNatures),
    position: d(p.position),
    workingYears: p.workingYears == null ? '—' : String(p.workingYears),
    sourceOfFunds: d(p.sourceOfFunds),
    sourcesOfWealth: d(p.sourcesOfWealth),
    annualIncome: d(p.annualIncome),
    netAssetValue: d(p.netAssetValue),
    assetItems: d(p.assetItems),
    declarationSigned: p.declarationSigned ? 'Yes' : 'No',
    signatureName: d(p.signatureName),
    declarationDate: d(p.declarationDate),
  }
}

function basicInfoTable(person: KeyPerson) {
  const W = [3855, 6827]
  return new Table({
    width: { size: W[0] + W[1], type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({ children: [sectionCell('Client Basic Information\n基本資料', W[0] + W[1], 2)] }),
      new TableRow({ children: [kycCell('Title 稱謂  ', W[0]), kycCell(titleOptions(person.titlePrefix), W[1])] }),
      new TableRow({ children: [kycCell('English Name 英文姓名 ', W[0]), kycCell(person.nameEn ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Chinese Name 中文姓名', W[0]), kycCell(person.nameZh ?? '', W[1])] }),
      new TableRow({ children: [kycCell('ID/Passport Number 證件號碼', W[0]), kycCell([person.idType, person.idNumber].filter(Boolean).join(': '), W[1])] }),
      new TableRow({ children: [kycCell('Place of Issue 簽發地', W[0]), kycCell(person.placeOfIssue ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Expiry Date 到期日', W[0]), kycCell(dDate(person.idExpiryDate), W[1])] }),
      new TableRow({ children: [kycCell('Date of Birth 出生日期', W[0]), kycCell(dDate(person.dateOfBirth), W[1])] }),
      new TableRow({ children: [kycCell('Nationality 國藉', W[0]), kycCell(person.nationality ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Home Address 住址', W[0]), kycCell(person.homeAddress ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Contact Address通訊地址', W[0]), kycCell(person.contactAddress ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Home Phone 住宅電話', W[0]), kycCell(person.homePhone ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Work Phone 辦公電話', W[0]), kycCell(person.workPhone ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Cell Phone 手機號', W[0]), kycCell(person.mobile ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Wechat 微信號', W[0]), kycCell(person.wechat ?? '', W[1])] }),
      new TableRow({ children: [kycCell('Email 電郵', W[0]), kycCell(person.email ?? '', W[1])] }),
      new TableRow({ children: [
        kycCell('US Citizen or US Tax Resident美國公民或就稅務目的而言的居民', W[0]),
        kycCell(`${person.isUsCitizen ? CHECK : EMPTY} Yes, and i confirm that (i) i am residing outside the USA and that all instructions will be given and all transactions will occur outside the USA; and (ii) i will not trade US stocks or in the US markets through 6AM Capital.\n是, 本人確認(i)本人並不居住於美國，及所有賬戶指令不會在美國境內發出, 與 (ii) 本人不會透過6am Capital在美國證券市場進行美股交易。\n${person.isUsCitizen === false ? CHECK : EMPTY} No 否`, W[1]),
      ] }),
      new TableRow({ children: [kycCell('Emergency Contact Person & Phone Number  緊急聯絡人與電話', W[0]), kycCell(person.emergencyContact ?? '', W[1])] }),
    ],
  })
}

function employmentLabel(status: string | null | undefined, key: string) {
  return checkedWhen(status === key)
}

function occupationTable(person: KeyPerson) {
  const W = [2276, 456, 1123, 1120, 456, 2103, 456, 2203, 489]
  const total = W.reduce((a, b) => a + b, 0)
  const v6 = W.slice(3).reduce((a, b) => a + b, 0)
  const v3 = W.slice(0, 3).reduce((a, b) => a + b, 0)
  const business = person.businessNatures ?? []
  const wealth = person.sourcesOfWealth ?? []
  const assets = person.assetItems ?? []
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({ children: [sectionCell('Occupation Information 工作資料', total, 9)] }),
      new TableRow({ children: [
        kycCell('Employment Status 就業情況', v3, 3),
        kycCell(`${employmentLabel(person.employmentStatus, 'EMPLOYED')} 受僱 ${employmentLabel(person.employmentStatus, 'SELF_EMPLOYED')} 自僱 ${employmentLabel(person.employmentStatus, 'RETIRED')} 退休 ${employmentLabel(person.employmentStatus, 'UNEMPLOYED')} 無業`, v6, 6),
      ] }),
      new TableRow({ children: [kycCell('Company Name 公司全名', v3, 3), kycCell(person.employerName ?? '', v6, 6)] }),
      new TableRow({ children: [kycCell('Company Address 公司地址', v3, 3), kycCell(person.employerAddress ?? '', v6, 6)] }),
      new TableRow({ children: [sectionCell('Nature of Business 業務性質', total, 9)] }),
      new TableRow({ children: [
        kycCell('Property investment物業投資', W[0]), kycCell(checkedWhen(includesAny(business, ['property'])), W[1]),
        kycCell('Financial institution\n金融機構', W[2] + W[3], 2), kycCell(checkedWhen(includesAny(business, ['financial institution'])), W[4]),
        kycCell('Trading\n貿易', W[5]), kycCell(checkedWhen(includesAny(business, ['trading'])), W[6]),
        kycCell('Manufacturing\n製造業', W[7]), kycCell(checkedWhen(includesAny(business, ['manufacturing'])), W[8]),
      ] }),
      new TableRow({ children: [
        kycCell('Agent/Consultancy\n代理或諮詢業務', W[0]), kycCell(checkedWhen(includesAny(business, ['agent', 'consult'])), W[1]),
        kycCell('Investment holding投資控股', W[2] + W[3], 2), kycCell(checkedWhen(includesAny(business, ['investment holding'])), W[4]),
        kycCell('Financial service\n金融服務業', W[5]), kycCell(checkedWhen(includesAny(business, ['financial service'])), W[6]),
        kycCell('Dormant\n不活躍', W[7]), kycCell(checkedWhen(includesAny(business, ['dormant'])), W[8]),
      ] }),
      new TableRow({ children: [
        kycCell('IT\n資訊業', W[0]), kycCell(checkedWhen(includesAny(business, ['it', 'technology'])), W[1]),
        kycCell('Advertising\n廣告業', W[2] + W[3], 2), kycCell(checkedWhen(includesAny(business, ['advertising'])), W[4]),
        kycCell('Restaurant\n飲食業', W[5]), kycCell(checkedWhen(includesAny(business, ['restaurant'])), W[6]),
        kycCell('Medical service\n醫療服務業', W[7]), kycCell(checkedWhen(includesAny(business, ['medical'])), W[8]),
      ] }),
      new TableRow({ children: [kycCell(`Others (please specify):\n其他 (請註明): ${business.join(', ')}`, total, 9)] }),
      new TableRow({ children: [kycCell('Position 職位', v3, 3), kycCell(person.position ?? '', v6, 6)] }),
      new TableRow({ children: [kycCell('Working Years 任職年數', v3, 3), kycCell(person.workingYears == null ? '' : String(person.workingYears), v6, 6)] }),
      new TableRow({ children: [sectionCell('Financial Profile 財務狀況', total, 9)] }),
      new TableRow({ children: [
        kycCell('Source of Wealth 財富來源', v3, 3),
        kycCell(`${checkedWhen(includesAny(wealth, ['salary', 'bonus']))} Salary and/or Bonus 薪金與花紅\n${checkedWhen(includesAny(wealth, ['investment']))} Investment 投資\n${checkedWhen(includesAny(wealth, ['inheritance']))} Inheritance 承繼\n${checkedWhen(includesAny(wealth, ['saving']))} Saving 儲蓄\n${checkedWhen(includesAny(wealth, ['business']))} Business Return 生意\n${checkedWhen(Boolean(person.sourceOfFunds || wealth.length))} Others (please specify) 其他 (請註明) ${[person.sourceOfFunds, ...wealth].filter(Boolean).join(', ')}`, v6, 6),
      ] }),
      new TableRow({ children: [kycCell('Annual Income 年收入 (USD)', v3, 3), kycCell(person.annualIncome ?? '□ <100,000    □ 100,000-500,000    □ 500,001-1,000,000    □ 1,000,001+', v6, 6)] }),
      new TableRow({ children: [kycCell('Net Value of Asset 總資產 (USD)', v3, 3), kycCell(person.netAssetValue ?? '□ <800,000    □ 800,001-3,000,000    □ 3,000,001+', v6, 6)] }),
      new TableRow({ children: [kycCell('Asset Items 資產項目', v3, 3), kycCell(`${checkedWhen(includesAny(assets, ['property']))} Property 房產  ${checkedWhen(includesAny(assets, ['deposit']))} Deposits 存款  ${checkedWhen(includesAny(assets, ['securities']))} Securities證券\n${checkedWhen(includesAny(assets, ['bond', 'fund']))} Bonds/Fund 債券/基金  ${checkedWhen(includesAny(assets, ['virtual']))} Virtual Asset 虛擬資產  ${checkedWhen(includesAny(assets, ['insurance']))} Insurance保險`, v6, 6)] }),
    ],
  })
}

function signatureTable(person: KeyPerson) {
  const W = [5166, 5156]
  return new Table({
    width: { size: W[0] + W[1], type: WidthType.DXA },
    columnWidths: W,
    rows: [new TableRow({ children: [
      kycCell(`BO Signature\n受益人簽署\n${person.signatureName ?? ''}`, W[0]),
      kycCell(`Date\n日期\n${dDate(person.declarationDate)}`, W[1]),
    ] })],
  })
}

/**
 * Built-in Word output matching PRD_DOC/KYC.docx.
 */
function buildProgrammaticDoc(persons: KeyPerson[]) {
  const blocks: (Paragraph | Table)[] = []

  persons.forEach((person, index) => {
    if (index > 0) blocks.push(new Paragraph({ children: [new PageBreak()] }))
    blocks.push(
      pText('Know Your Client (KYC) Form for Individual Client', { bold: true, size: 24 }),
      pText('自然人「認識您的客戶」表格', { bold: true, size: 24 }),
      pText('The information below is required to comply with the Anti-Money Laundering Laws of the relevant jurisdiction, and to eliminate the risk that the legal operation of your company is affected in the future.', { size: 17 }),
      pText('為了符合相關司法管轄區的反洗錢法律要求，及以免影響貴公司日後的合法經營，請提供以下資料。', { size: 17 }),
      new Paragraph({ children: [new TextRun({ text: '' })] }),
      basicInfoTable(person),
      new Paragraph({ children: [new TextRun({ text: '' })] }),
      occupationTable(person),
      new Paragraph({ children: [new TextRun({ text: '' })] }),
      pText('Declaration/ Undertaking: 聲明/ 承諾:', { bold: true, size: 18 }),
      pText('I/ We confirm that the above information is true and accurate, and we are authorized to supply any or all of such information for due diligence purposes to the Regulators if so requested by them.', { size: 17 }),
      pText('本人/吾等確認以上資料真實無誤, 及如監管機構提出要求, 我們有權向監管機構提供任何或所有資料以供審查。', { size: 17 }),
      pText('I/ We understand the legal and tax reporting requirements and other responsibilities in my/ our country of residence and/ or other applicable jurisdictions and will comply with all the relevant reporting requirements on my/ our own. I/ We understand that 6AM Capital strongly suggests me/ us to seek independent tax advice from a third party tax professional not associated with 6 AM Capital in respect of this structure if necessary.', { size: 17 }),
      pText('本人/ 吾等明白本人/ 吾等居住國家和/ 或其他適用司法管轄區的法律和稅務申報要求及其他責任，並將遵守本人/ 吾等的所有相關申報要求。本人/ 吾等明白6AM Advisory Limited強烈建議本人/ 吾等在有需要的時候向6AM Advisory Limited以外的第三方稅務專家就本結構尋求獨立的稅務意見。', { size: 17 }),
      pText('I/ We understand and agree that all documents supplied (including this form) will not be returned to me/ us.', { size: 17 }),
      pText('本人/ 吾等理解並同意提供的所有文件（包括本表格）將不會退還。', { size: 17 }),
      pText('I/ We also undertake to notify 6AM Advisory Limited of any future changes to the above information.', { size: 17 }),
      pText('本人/ 吾等承諾若上述資料如有更改將通知6 AM Advisory Limited。', { size: 17 }),
      pText('I/ We understand that 6 AM Advisory Limited reserves the rights to request for additional documentation/ information.', { size: 17 }),
      pText('本人/ 吾等明白6AM Advisory Limited保留要求提供其他補充文件/資料的權利。', { size: 17 }),
      new Paragraph({ children: [new TextRun({ text: '' })] }),
      signatureTable(person),
    )
  })

  return new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: blocks,
    }],
  })
}

type TemplatePerson = ReturnType<typeof personToRowLabelMap> & { index: number; nameEnRaw: string; kycStatus: string }

function buildTemplateData(persons: KeyPerson[]) {
  return {
    exportDate: new Date().toISOString().split('T')[0],
    persons: persons.map((p, i) => {
      const m = personToRowLabelMap(p)
      return {
        index: i + 1,
        nameEnRaw: p.nameEn,
        kycStatus: p.kycStatus,
        ...m,
      } as TemplatePerson
    }),
  }
}

const TEMPLATE_CANDIDATES = ['KYC.docx', 'kyc.docx', 'KYC.template.docx']

/**
 * If `templates/KYC.docx` exists and uses docxtemplater tags (e.g. `{#persons}…{/persons}` or `{nameEn}`),
 * it is used; otherwise a structured document is built with the `docx` library.
 */
export async function generateKycDocxBuffer(persons: KeyPerson[], cwd = process.cwd()): Promise<Buffer> {
  for (const name of TEMPLATE_CANDIDATES) {
    const p = join(cwd, 'templates', name)
    if (existsSync(p)) {
      try {
        const data = readFileSync(p)
        const zip = new PizZip(data)
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: '{', end: '}' } })
        doc.setData(buildTemplateData(persons))
        doc.render()
        return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer
      } catch (e) {
        console.error('[KYC docx] template render failed, falling back to built-in table:', e)
        break
      }
    }
  }
  const built = buildProgrammaticDoc(persons)
  return Packer.toBuffer(built)
}

export function kycDocumentFilename() {
  return `KYC-filled-${new Date().toISOString().split('T')[0]}.docx`
}
