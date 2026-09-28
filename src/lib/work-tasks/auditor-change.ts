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

export type AuditorAction = 'APPOINT' | 'REMOVE' | 'RESIGN'

export type AuditorChangeInput = CrPresentor & {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  action: AuditorAction
  auditorName: string
  auditorAddress: string
  effectiveDate: string
  meetingDate: string
  meetingTime: string
  meetingPlace: string
  directorName1: string
  directorName2: string
  shareholderName1: string
  shareholderName2: string
  signatoryName: string
  signatoryCapacity: 'DIRECTOR' | 'COMPANY_SECRETARY'
  signatoryDate: string
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
  throw new Error(`找不到核数师模板：${fileName}`)
}

function presentorName(input: CrPresentor) {
  return input.presentorNameEn.trim() || input.presentorNameZh.trim()
}

function placeholders(input: AuditorChangeInput): Record<string, PlaceholderValue> {
  return {
    '[Company Name (English)]': input.companyNameEn,
    '[Company Name (Chinese)]': input.companyNameZh,
    '[Company No.]': input.companyNo,
    '[BR No.]': crBrn(input.brn || input.companyNo),
    '[Date]': isoSlashDate(input.signatoryDate || input.effectiveDate),
    '[Auditor Name]': input.auditorName,
    '[Auditor Address]': input.auditorAddress,
    '[Effective Date]': isoSlashDate(input.effectiveDate),
    '[Meeting Date]': input.meetingDate ? isoSlashDate(input.meetingDate) : isoSlashDate(input.effectiveDate),
    '[at a general meeting of the Company to be held on [Meeting Date]': `at a general meeting of the Company to be held on ${input.meetingDate ? isoSlashDate(input.meetingDate) : isoSlashDate(input.effectiveDate)}`,
    '[Time]': input.meetingTime.trim() || '10:00 a.m.',
    '[Place]': input.meetingPlace.trim() || 'the registered office of the Company',
    '[Director Name]': input.directorName1,
    '[Director Name 1]': input.directorName1,
    '[Director Name 2]': input.directorName2,
    '[Shareholder Name 1]': input.shareholderName1,
    '[Shareholder Name 2]': input.shareholderName2,
    '[6AM Advisory Limited]': '6AM Advisory Limited',
    '[Select and delete unused block:]': '',
    '[the conclusion of the next annual general meeting / such time as may be determined]': 'the conclusion of the next annual general meeting',
  }
}

async function renderDocx(fileName: string, templateKey: string, label: string, input: AuditorChangeInput) {
  const buffer = await fillDocxTemplate(await resolveTemplate(fileName), placeholders(input))
  return { templateKey, fileName: downloadName(label, input.companyNameEn, 'docx'), buffer, mimeType: DOCX_MIME }
}

function fillAuditorPresentor(form: ReturnType<PDFDocument['getForm']>, input: CrPresentor) {
  crPdf.setText(form, 'fill_16_P.1', presentorName(input))
  crPdf.setText(form, 'fill_17_P.1', input.presentorAddress)
  crPdf.setText(form, 'fill_18_P.1', input.presentorTel)
  crPdf.setText(form, 'fill_19_P.1', input.presentorFax)
  crPdf.setText(form, 'fill_20_P.1', input.presentorEmail)
  crPdf.setText(form, 'fill_21_P.1', input.presentorReference)
}

export async function renderNa1(input: AuditorChangeInput) {
  const brn = crBrn(input.brn || input.companyNo)
  const buffer = await renderCrPdf('NA1_Removal_of_Auditor.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    crPdf.setText(form, 'fill_3_P.1', input.auditorName)
    crPdf.setText(form, 'fill_4_P.1', input.auditorAddress)
    crPdf.setDate(form, 'fill_8_P.1', 'fill_9_P.1', 'fill_10_P.1', input.meetingDate || input.effectiveDate)
    crPdf.setDate(form, 'fill_11_P.1', 'fill_12_P.1', 'fill_13_P.1', input.effectiveDate)
    crPdf.setText(form, 'fill_14_P.1', input.signatoryName)
    crPdf.setText(form, 'fill_15_P.1', isoSlashDate(input.signatoryDate))
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown_2_P.1' : 'Dropdown_1_P.1')
    fillAuditorPresentor(form, input)
  })
  return {
    templateKey: 'na1',
    fileName: downloadName('NA1-将核数师免任通知书', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderNa2(input: AuditorChangeInput) {
  const brn = crBrn(input.brn || input.companyNo)
  const buffer = await renderCrPdf('NA2_Resignation_of_Auditor.pdf', form => {
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    crPdf.setDate(form, 'fill_3_P.1', 'fill_4_P.1', 'fill_5_P.1', input.effectiveDate)
    crPdf.setText(form, 'fill_6_P.1', input.auditorName)
    crPdf.setText(form, 'fill_7_P.1', input.auditorAddress)
    crPdf.setDate(form, 'fill_11_P.1', 'fill_12_P.1', 'fill_13_P.1', input.signatoryDate)
    crPdf.setText(form, 'fill_14_P.1', input.signatoryName)
    crPdf.setText(form, 'fill_15_P.1', isoSlashDate(input.signatoryDate))
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown2_P.1' : 'Dropdown1_P.1')
    fillAuditorPresentor(form, input)
  })
  return {
    templateKey: 'na2',
    fileName: downloadName('NA2-核数师辞任通知书', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderAuditorChangeDocuments(input: AuditorChangeInput) {
  if (input.action === 'APPOINT') {
    return [await renderDocx('Written Resolutions - Appointment of Auditor.docx', 'appointment-resolutions', '书面决议-委任核数师', input)]
  }
  if (input.action === 'RESIGN') {
    return [await renderNa2(input)]
  }
  const [notice, resolution, na1] = await Promise.all([
    renderDocx('Notice of Intention to Remove Auditor.docx', 'removal-notice', '拟将核数师免任通知', input),
    renderDocx('Ordinary Resolution - Removal of Auditor.docx', 'removal-resolution', '普通决议-将核数师免任', input),
    renderNa1(input),
  ])
  return [notice, resolution, na1]
}
