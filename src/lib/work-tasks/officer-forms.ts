import { access } from 'node:fs/promises'
import path from 'node:path'
import type { PDFDocument } from 'pdf-lib'
import {
  crBrn,
  crCompanyName,
  crPdf,
  isoSlashDate,
  renderCrPdf,
  type CrPresentor,
} from '@/lib/work-tasks/cr-pdf'
import { fillDocxTemplate, type PlaceholderValue } from '@/lib/work-tasks/fill-docx'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF_MIME = 'application/pdf'

export type OfficerOffice = 'DIRECTOR' | 'COMPANY_SECRETARY' | 'ALTERNATE_DIRECTOR'
export type OfficerPersonKind = 'NATURAL' | 'CORPORATE'

export type OfficerChangeInput = CrPresentor & {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  office: OfficerOffice
  personKind: OfficerPersonKind
  nameEn: string
  nameZh: string
  surname: string
  otherNames: string
  hkid: string
  passport: string
  passportPlace: string
  idNumber: string
  nationality: string
  email: string
  flat: string
  building: string
  street: string
  district: string
  country: string
  effectiveDate: string
  signatoryName: string
  signatoryCapacity: 'DIRECTOR' | 'COMPANY_SECRETARY'
  signatoryDate: string
  directorName1: string
  directorName2: string
  tcspLicence: string
}

function safeCompany(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
}

function downloadName(label: string, companyName: string, ext: 'docx' | 'pdf'): string {
  return `${label} - ${safeCompany(companyName)}.${ext}`.slice(0, 180)
}

async function resolveTemplate(fileName: string): Promise<string> {
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/secretarial/officers', fileName),
    path.join(/* turbopackIgnore: true */ process.cwd(), 'Secretarial Template', fileName),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try next
    }
  }
  throw new Error(`找不到秘书模板：${fileName}`)
}

export function officerEnglishParts(input: { nameEn: string; surname: string; otherNames: string }) {
  const surname = input.surname.trim()
  const other = input.otherNames.trim()
  if (surname || other) return { surname, otherNames: other }
  const tokens = input.nameEn.trim().split(/\s+/).filter(Boolean)
  if (tokens.length <= 1) return { surname: input.nameEn.trim(), otherNames: '' }
  return { surname: tokens[0], otherNames: tokens.slice(1).join(' ') }
}

function officeLabel(office: OfficerOffice) {
  if (office === 'COMPANY_SECRETARY') return 'Company Secretary'
  if (office === 'ALTERNATE_DIRECTOR') return 'Alternate Director'
  return 'Director'
}

function officeLabelZh(office: OfficerOffice) {
  if (office === 'COMPANY_SECRETARY') return '公司秘书'
  if (office === 'ALTERNATE_DIRECTOR') return '候補董事'
  return '董事'
}

/** CR partial HKID: letter(s) + first 3 digits; last 4 chars stay as printed asterisks. */
export function partialHkidNumber(hkid: string): string {
  const raw = hkid.trim().toUpperCase().replace(/\s+/g, '')
  if (!raw) return ''
  const match = raw.match(/^([A-Z]{1,2})(\d{6})(?:\([A-Z0-9]\))?$/)
  if (match) return `${match[1]}${match[2].slice(0, 3)}`
  const alnum = raw.replace(/[^A-Z0-9]/g, '')
  if (alnum.length <= 4) return alnum
  return alnum.slice(0, -4)
}

function presentorName(input: CrPresentor) {
  return input.presentorNameEn.trim() || input.presentorNameZh.trim()
}

function fillPresentor(
  form: ReturnType<PDFDocument['getForm']>,
  input: CrPresentor,
  fields: [string, string, string, string, string, string],
) {
  crPdf.setText(form, fields[0], presentorName(input))
  crPdf.setText(form, fields[1], input.presentorAddress)
  crPdf.setText(form, fields[2], input.presentorTel)
  crPdf.setText(form, fields[3], input.presentorFax)
  crPdf.setText(form, fields[4], input.presentorEmail)
  crPdf.setText(form, fields[5], input.presentorReference)
}

/** Capacity checkboxes left→right: Company Secretary, Director, Alternate Director. */
function tickOffice(
  form: ReturnType<PDFDocument['getForm']>,
  office: OfficerOffice,
  cs: string,
  director: string,
  alternate?: string,
) {
  if (office === 'COMPANY_SECRETARY') crPdf.checkBox(form, cs)
  else if (office === 'ALTERNATE_DIRECTOR') crPdf.checkBox(form, alternate || director)
  else crPdf.checkBox(form, director)
}

async function renderDocx(fileName: string, templateKey: string, label: string, companyName: string, values: Record<string, PlaceholderValue>) {
  const templatePath = await resolveTemplate(fileName)
  const buffer = await fillDocxTemplate(templatePath, values)
  return { templateKey, fileName: downloadName(label, companyName, 'docx'), buffer, mimeType: DOCX_MIME }
}

function commonPlaceholders(input: OfficerChangeInput): Record<string, PlaceholderValue> {
  const { surname, otherNames } = officerEnglishParts(input)
  const fullEn = [surname, otherNames].filter(Boolean).join(' ') || input.nameEn
  const officeEn = officeLabel(input.office)
  const idNo = input.idNumber || input.hkid || input.passport
  return {
    '[Company Name (English)]': input.companyNameEn,
    '[Company Name (Chinese)]': input.companyNameZh,
    '[Company No.]': input.companyNo,
    '[BR No.]': crBrn(input.brn || input.companyNo),
    '[Date]': isoSlashDate(input.signatoryDate || input.effectiveDate),
    '[Effective Date]': isoSlashDate(input.effectiveDate),
    '[Effective Date / the date hereof]': isoSlashDate(input.effectiveDate),
    '[Director / Company Secretary / Both]': officeEn,
    '[Director / Company Secretary]': officeEn,
    '[Full Name]': fullEn,
    '[Director Name]': fullEn,
    '[Chinese Name]': input.nameZh,
    '[Former Name / N/A]': 'N/A',
    '[ID/Passport No.]': idNo,
    '[ID No.]': idNo,
    '[Signature ID Line]':
      input.office === 'COMPANY_SECRETARY'
        ? ''
        : `(Holder of HKID / Passport No.: ${idNo})`,
    '[Nationality]': input.nationality,
    '[Residential Address]': [input.flat, input.building, input.street, input.district, input.country].filter(Boolean).join(', '),
    '[Correspondence Address / Same as above]': 'Same as above',
    '[Address]': [input.flat, input.building, input.street, input.district, input.country].filter(Boolean).join(', '),
    '[Corporate Director Name]': input.personKind === 'CORPORATE' ? input.nameEn : '',
    '[Place]': input.passportPlace,
    '[No.]': input.idNumber || input.hkid || input.passport,
    '[Signatory Name]': input.signatoryName,
    '[Director / Authorised Signatory]': input.signatoryCapacity === 'COMPANY_SECRETARY' ? 'Authorised Signatory' : 'Director',
    '[CS Entity No. / N/A]': input.tcspLicence || 'N/A',
    '[CS Individual Name]': input.personKind === 'NATURAL' ? fullEn : '',
    '[Director Name 1]': input.directorName1,
    '[Director Name 2]': input.directorName2,
    '[resolution]': `THAT ${fullEn} be appointed as ${officeEn.toLowerCase()} of the Company with effect from ${isoSlashDate(input.effectiveDate)}.`,
  }
}

export async function renderNd4(input: OfficerChangeInput) {
  const brn = crBrn(input.brn || input.companyNo)
  const { surname, otherNames } = officerEnglishParts(input)
  const buffer = await renderCrPdf('ND4_Resignation_CS_Director.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    tickOffice(form, input.office, 'cb_1_P.1', 'cb_2_P.1', 'cb_3_P.1')
    if (input.personKind === 'CORPORATE') {
      crPdf.setText(form, 'fill_9_P.1', input.nameZh)
      crPdf.setText(form, 'fill_10_P.1', input.nameEn)
    } else {
      crPdf.setText(form, 'fill_4_P.1', input.nameZh)
      crPdf.setText(form, 'fill_5_P.1', surname)
      crPdf.setText(form, 'fill_6_P.1', otherNames)
      crPdf.setText(form, 'fill_7_P.1', partialHkidNumber(input.hkid))
      crPdf.setText(form, 'fill_8_P.1', input.passport)
    }
    crPdf.setDate(form, 'fill_11_P.1', 'fill_12_P.1', 'fill_13_P.1', input.effectiveDate)
    fillPresentor(form, input, ['fill_14_P.1', 'fill_15_P.1', 'fill_16_P.1', 'fill_17_P.1', 'fill_18_P.1', 'fill_19_P.1'])
    crPdf.setText(form, 'fill_2_P.2', input.signatoryName || officerEnglishParts(input).surname || input.nameEn)
    crPdf.setText(form, 'fill_3_P.2', isoSlashDate(input.signatoryDate))
    if (input.office === 'COMPANY_SECRETARY') crPdf.strikeDropdown(form, 'Dropdown1_P.2')
    else crPdf.strikeDropdown(form, 'Dropdown2_P.2')
  })
  return {
    templateKey: 'nd4',
    fileName: downloadName('ND4-秘书及董事辞任通知书', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderNd2aCessation(input: OfficerChangeInput) {
  const brn = crBrn(input.brn || input.companyNo)
  const { surname, otherNames } = officerEnglishParts(input)
  const buffer = await renderCrPdf('ND2A_Change_CS_Director_Appointment_Cessation.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_1_P.3', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    tickOffice(form, input.office, 'cb_1_P.1', 'cb_2_P.1', 'cb_3_P.1')
    if (input.personKind === 'CORPORATE') {
      crPdf.setText(form, 'fill_9_P.1', input.nameZh)
      crPdf.setText(form, 'fill_10_P.1', input.nameEn)
    } else {
      crPdf.setText(form, 'fill_4_P.1', input.nameZh)
      crPdf.setText(form, 'fill_5_P.1', surname)
      crPdf.setText(form, 'fill_6_P.1', otherNames)
      crPdf.setText(form, 'fill_7_P.1', partialHkidNumber(input.hkid))
      crPdf.setText(form, 'fill_8_P.1', input.passport)
    }
    crPdf.checkBox(form, 'cb_4_P.1')
    crPdf.setDate(form, 'fill_11_P.1', 'fill_12_P.1', 'fill_13_P.1', input.effectiveDate)
    crPdf.checkBox(form, 'cb_7_P.1')
    fillPresentor(form, input, ['fill_14_P.1', 'fill_15_P.1', 'fill_16_P.1', 'fill_17_P.1', 'fill_18_P.1', 'fill_19_P.1'])
    crPdf.setText(form, 'fill_22_P.3', input.signatoryName)
    crPdf.setText(form, 'fill_23_P.3', isoSlashDate(input.signatoryDate))
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown_7_P.3' : 'Dropdown_6_P.3')
  })
  return {
    templateKey: 'nd2a',
    fileName: downloadName('ND2A-更改公司秘书及董事通知书-停任', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderNd2aAppointment(input: OfficerChangeInput) {
  const brn = crBrn(input.brn || input.companyNo)
  const { surname, otherNames } = officerEnglishParts(input)
  const buffer = await renderCrPdf('ND2A_Change_CS_Director_Appointment_Cessation.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_1_P.3', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    fillPresentor(form, input, ['fill_14_P.1', 'fill_15_P.1', 'fill_16_P.1', 'fill_17_P.1', 'fill_18_P.1', 'fill_19_P.1'])
    if (input.personKind === 'NATURAL') {
      tickOffice(form, input.office, 'cb_1_P.2', 'cb_2_P.2', 'cb_3_P.2')
      crPdf.setText(form, 'fill_3_P.2', input.nameZh)
      crPdf.setText(form, 'fill_4_P.2', surname)
      crPdf.setText(form, 'fill_5_P.2', otherNames)
      crPdf.setText(form, 'fill_10_P.2', input.flat)
      crPdf.setText(form, 'fill_11_P.2', input.building)
      crPdf.setText(form, 'fill_12_P.2', input.street)
      crPdf.setText(form, 'fill_13_P.2', input.district)
      crPdf.setText(form, 'fill_14_P.2', input.country || 'Hong Kong')
      crPdf.setText(form, 'fill_15_P.2', input.email)
      crPdf.setText(form, 'fill_16_P.2', partialHkidNumber(input.hkid))
      crPdf.setText(form, 'fill_17_P.2', input.passportPlace)
      crPdf.setText(form, 'fill_18_P.2', input.passport)
      crPdf.setText(form, 'fill_19_P.2', input.tcspLicence)
      crPdf.setDate(form, 'fill_21_P.2', 'fill_22_P.2', 'fill_23_P.2', input.effectiveDate)
      crPdf.checkBox(form, 'cb_6_P.2')
      if (input.office !== 'COMPANY_SECRETARY') crPdf.strikeDropdown(form, 'Dropdown_2_P.2')
    } else {
      tickOffice(form, input.office, 'cb_1_P.3', 'cb_2_P.3', 'cb_3_P.3')
      crPdf.setText(form, 'fill_3_P.3', input.nameZh)
      crPdf.setText(form, 'fill_4_P.3', input.nameEn)
      crPdf.setText(form, 'fill_5_P.3', input.flat)
      crPdf.setText(form, 'fill_6_P.3', input.building)
      crPdf.setText(form, 'fill_7_P.3', input.street)
      crPdf.setText(form, 'fill_8_P.3', input.district)
      crPdf.setText(form, 'fill_9_P.3', input.country || 'Hong Kong')
      crPdf.setText(form, 'fill_10_P.3', input.email)
      crPdf.setText(form, 'fill_11_P.3', crBrn(input.brn))
      crPdf.setText(form, 'fill_12_P.3', input.tcspLicence)
      crPdf.setDate(form, 'fill_14_P.3', 'fill_15_P.3', 'fill_16_P.3', input.effectiveDate)
      crPdf.checkBox(form, 'cb_6_P.3')
    }
    crPdf.setText(form, 'fill_22_P.3', input.signatoryName)
    crPdf.setText(form, 'fill_23_P.3', isoSlashDate(input.signatoryDate))
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown_7_P.3' : 'Dropdown_6_P.3')
  })
  return {
    templateKey: 'nd2a',
    fileName: downloadName('ND2A-更改公司秘书及董事通知书-委任', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderNd2b(input: OfficerChangeInput) {
  const brn = crBrn(input.brn || input.companyNo)
  const { surname, otherNames } = officerEnglishParts(input)
  const parts = input.effectiveDate.split('-')
  const dd = parts[2] ?? ''
  const mm = parts[1] ?? ''
  const yyyy = parts[0] ?? ''
  const buffer = await renderCrPdf('ND2B_Change_Particulars_CS_Director.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_1_P.3', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    tickOffice(form, input.office, 'cb_1_P.1', 'cb_2_P.1', 'cb_3_P.1')
    if (input.personKind === 'CORPORATE') {
      crPdf.setText(form, 'fill_3_P.1', input.nameZh)
      crPdf.setText(form, 'fill_4_P.1', input.nameEn)
    } else {
      crPdf.setText(form, 'fill_3_P.1', input.nameZh)
      crPdf.setText(form, 'fill_4_P.1', surname)
      crPdf.setText(form, 'fill_5_P.1', otherNames)
      crPdf.setText(form, 'fill_6_P.1', partialHkidNumber(input.hkid))
      crPdf.setText(form, 'fill_7_P.1', input.passport)
    }
    fillPresentor(form, input, ['fill_8_P.1', 'fill_9_P.1', 'fill_10_P.1', 'fill_11_P.1', 'fill_12_P.1', 'fill_13_P.1'])
    if (input.personKind === 'NATURAL') {
      crPdf.setText(form, 'fill_2_P.2', input.nameZh)
      crPdf.setText(form, 'fill_3_P.2', dd)
      crPdf.setText(form, 'fill_4_P.2', mm)
      crPdf.setText(form, 'fill_5_P.2', yyyy)
      crPdf.setText(form, 'fill_6_P.2', surname)
      crPdf.setText(form, 'fill_8_P.2', dd)
      crPdf.setText(form, 'fill_9_P.2', mm)
      crPdf.setText(form, 'fill_10_P.2', yyyy)
      crPdf.setText(form, 'fill_7_P.2', otherNames)
      crPdf.setText(form, 'fill_19_P.2', input.flat)
      crPdf.setText(form, 'fill_20_P.2', input.building)
      crPdf.setText(form, 'fill_21_P.2', input.street)
      crPdf.setText(form, 'fill_22_P.2', input.district)
      crPdf.setText(form, 'fill_23_P.2', input.country || 'Hong Kong')
      crPdf.setText(form, 'fill_24_P.2', dd)
      crPdf.setText(form, 'fill_25_P.2', mm)
      crPdf.setText(form, 'fill_26_P.2', yyyy)
      crPdf.setText(form, 'fill_27_P.2', input.email)
      crPdf.setText(form, 'fill_28_P.2', dd)
      crPdf.setText(form, 'fill_29_P.2', mm)
      crPdf.setText(form, 'fill_30_P.2', yyyy)
      crPdf.setText(form, 'fill_31_P.2', input.hkid || input.passport)
    } else {
      crPdf.setText(form, 'fill_2_P.3', input.nameZh)
      crPdf.setText(form, 'fill_3_P.3', input.nameEn)
      crPdf.setText(form, 'fill_5_P.3', input.flat)
      crPdf.setText(form, 'fill_6_P.3', input.building)
      crPdf.setText(form, 'fill_10_P.3', input.street)
      crPdf.setText(form, 'fill_11_P.3', input.district)
      crPdf.setText(form, 'fill_12_P.3', input.country || 'Hong Kong')
      crPdf.setText(form, 'fill_18_P.3', input.email)
    }
    crPdf.setText(form, 'fill_30_P.3', input.signatoryName)
    crPdf.setText(form, 'fill_31_P.3', isoSlashDate(input.signatoryDate))
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown_2_P.3' : 'Dropdown_1_P.3')
  })
  return {
    templateKey: 'nd2b',
    fileName: downloadName('ND2B-更改公司秘书及董事详情通知书', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderOfficerResignationPack(input: OfficerChangeInput) {
  const [letter, nd4, nd2a] = await Promise.all([
    renderDocx(
      'Resignation Letter - CS or Director.docx',
      'resignation-letter',
      `${officeLabelZh(input.office)}辞任信`,
      input.companyNameEn,
      commonPlaceholders(input),
    ),
    renderNd4(input),
    renderNd2aCessation(input),
  ])
  return [letter, nd4, nd2a]
}

export async function renderOfficerAppointmentPack(input: OfficerChangeInput) {
  const consentFile = input.office === 'COMPANY_SECRETARY'
    ? 'Consent to Act as Company Secretary.docx'
    : 'Consent to Act as Director.docx'
  const [consent, resolutions, nd2a] = await Promise.all([
    renderDocx(consentFile, 'consent', `出任${officeLabelZh(input.office)}同意书`, input.companyNameEn, commonPlaceholders(input)),
    renderDocx('Written Resolutions - Directors.docx', 'directors-resolutions', '董事书面决议-委任', input.companyNameEn, commonPlaceholders(input)),
    renderNd2aAppointment(input),
  ])
  return [consent, resolutions, nd2a]
}

export async function renderOfficerParticularsPack(input: OfficerChangeInput) {
  return [await renderNd2b(input)]
}
