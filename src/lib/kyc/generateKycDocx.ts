import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, BorderStyle,
  WidthType, ShadingType, HeadingLevel,
} from 'docx'
import type { KeyPerson } from '@prisma/client'

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const borders = { top: border, bottom: border, left: border, right: border }
const thShading = { fill: 'E8E0D0', type: ShadingType.CLEAR }
const cellM = { top: 60, bottom: 60, left: 100, right: 100 }

function d(v: unknown) {
  if (v == null) return '—'
  if (v instanceof Date) return v.toISOString().split('T')[0]
  if (Array.isArray(v)) return v.filter(Boolean).join(', ') || '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v) || '—'
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

const FIELD_ROWS: { key: keyof ReturnType<typeof personToRowLabelMap>; en: string }[] = [
  { key: 'titlePrefix', en: 'Title' },
  { key: 'nameEn', en: 'Full name (English)' },
  { key: 'nameZh', en: 'Full name (Chinese)' },
  { key: 'idType', en: 'ID / passport type' },
  { key: 'idNumber', en: 'ID / passport no.' },
  { key: 'placeOfIssue', en: 'Place of issue' },
  { key: 'placeOfBirth', en: 'Place of birth' },
  { key: 'idExpiryDate', en: 'ID / passport expiry' },
  { key: 'dateOfBirth', en: 'Date of birth' },
  { key: 'nationality', en: 'Nationality' },
  { key: 'homeAddress', en: 'Residential address' },
  { key: 'contactAddress', en: 'Correspondence address' },
  { key: 'homePhone', en: 'Home phone' },
  { key: 'workPhone', en: 'Work phone' },
  { key: 'mobile', en: 'Mobile' },
  { key: 'wechat', en: 'WeChat' },
  { key: 'email', en: 'Email' },
  { key: 'isUsCitizen', en: 'US citizen / US tax resident' },
  { key: 'isPep', en: 'PEP (politically exposed person)' },
  { key: 'emergencyContact', en: 'Emergency contact' },
  { key: 'employmentStatus', en: 'Employment status' },
  { key: 'employerName', en: 'Employer / business name' },
  { key: 'employerAddress', en: 'Employer address' },
  { key: 'businessNatures', en: 'Nature of business' },
  { key: 'position', en: 'Position / title' },
  { key: 'workingYears', en: 'Years in current role' },
  { key: 'sourceOfFunds', en: 'Source of funds' },
  { key: 'sourcesOfWealth', en: 'Source(s) of wealth' },
  { key: 'annualIncome', en: 'Annual income' },
  { key: 'netAssetValue', en: 'Net asset value' },
  { key: 'assetItems', en: 'Asset breakdown' },
  { key: 'declarationSigned', en: 'Declaration signed' },
  { key: 'signatureName', en: 'Signatory (printed name)' },
  { key: 'declarationDate', en: 'Declaration date' },
]

function makeLabelTable(rows: { label: string; value: string }[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: rows.map(
      r =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: cellM,
              shading: thShading,
              borders,
              children: [new Paragraph({ children: [new TextRun({ text: r.label, bold: true, size: 20 })] })],
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              margins: cellM,
              borders,
              children: [new Paragraph({ children: [new TextRun({ text: r.value, size: 20 })] })],
            }),
          ],
        })
    ),
  })
}

/**
 * Build-in Word output when `templates/KYC.docx` is not present.
 */
function buildProgrammaticDoc(persons: KeyPerson[]) {
  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '6AM Advisory — Know Your Client (KYC)', bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Generated: ${new Date().toISOString().split('T')[0]}`, size: 20, italics: true })],
    }),
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  ]

  for (let i = 0; i < persons.length; i++) {
    const p = persons[i]!
    const m = personToRowLabelMap(p)
    const rows = FIELD_ROWS.map(fr => ({ label: fr.en, value: m[fr.key] }))
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Person ${i + 1} — ${p.nameEn}`, bold: true, size: 28 })],
      }),
      new Paragraph({ children: [new TextRun({ text: `KYC status: ${p.kycStatus}`, size: 20, color: '666666' })] }),
      new Paragraph({ children: [new TextRun({ text: '' })] }),
      makeLabelTable(rows),
      new Paragraph({ children: [new TextRun({ text: '' })] })
    )
  }

  return new Document({ sections: [{ children: blocks }] })
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
