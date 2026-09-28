import { access } from 'node:fs/promises'
import path from 'node:path'
import {
  crBrn,
  crCompanyName,
  crPdf,
  isoDateParts,
  isoSlashDate,
  renderCrPdf,
  type CrPresentor,
} from '@/lib/work-tasks/cr-pdf'
import { fillDocxTemplate, type PlaceholderValue } from '@/lib/work-tasks/fill-docx'
import { integerToWords } from '@/lib/work-tasks/number-words'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF_MIME = 'application/pdf'

export type ShareAllotmentInput = CrPresentor & {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  brn: string
  allotmentDate: string
  allotteeName: string
  allotteeNameZh: string
  allotteeAddress: string
  numberOfShares: number
  shareClass: string
  currency: string
  amountPaidPerShare: string
  amountUnpaidPerShare: string
  consideration: string
  paidStatus: 'Fully paid' | 'Partly paid'
  certNo: string
  directorName1: string
  directorName2: string
  meetingTime: string
  meetingPlace: string
  companySecretary: string
  useCommonSeal: boolean
  capitalIncreaseAmount: string
  issuedTotalNumber: string
  issuedTotalAmount: string
  issuedPaidUp: string
  issuedUnpaid: string
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
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/secretarial/share-allotment', fileName),
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
  throw new Error(`找不到配售新股模板：${fileName}`)
}

function allotmentPlaceholders(input: ShareAllotmentInput): Record<string, PlaceholderValue> {
  const [year, month, day] = input.allotmentDate.split('-').map(Number)
  const monthName = MONTHS[month - 1] ?? ''
  const paidLabel = input.paidStatus === 'Fully paid' ? 'Fully' : 'Partly'
  return {
    '[Company Name (English)]': input.companyNameEn,
    '[Company Name (Chinese)]': input.companyNameZh,
    '[Company No.]': input.companyNo,
    '[Date]': `${day} ${monthName} ${year}`,
    '[Day]': String(day),
    '[Month]': monthName,
    '[Year]': String(year),
    '[Time]': input.meetingTime.trim() || '10:00 a.m.',
    '[Place / by electronic means]': input.meetingPlace.trim() || 'the registered office of the Company',
    '[Director Name 1]': input.directorName1,
    '[Director Name 2]': input.directorName2.trim() || '',
    '[Company Secretary / 6AM Advisory Limited / Other]': input.companySecretary.trim() || '6AM Advisory Limited',
    '[Allottee Name]': input.allotteeName,
    '[Applicant Name]': input.allotteeName,
    '[Applicant Address]': input.allotteeAddress,
    '[Shareholder Name]': input.allotteeName,
    '[Shareholder Address]': input.allotteeAddress,
    '[Number]': String(input.numberOfShares),
    '[Number in words]': integerToWords(input.numberOfShares),
    '[Class]': input.shareClass,
    '[Amount]': input.consideration,
    '[other consideration]': '',
    '[description of non-cash consideration, if any]': '',
    '[Fully / Partly]': paidLabel,
    '[Fully paid / Partly paid]': input.paidStatus,
    '[Paid Amount]': input.amountPaidPerShare,
    '[Cert No.]': input.certNo,
    '[No.]': input.certNo,
    '[Nationality / Place]': '',
    '[Capacity]': 'Applicant',
    '[Director Name]': input.directorName1,
    '[CS Name / 6AM Advisory Limited]': input.companySecretary.trim() || '6AM Advisory Limited',
    '[the Common Seal of the Company / the hand(s) of the authorised signatories]': input.useCommonSeal
      ? 'the Common Seal of the Company'
      : 'the hand(s) of the authorised signatories',
    '[Common Seal affix here, if any]': input.useCommonSeal ? '[Common Seal]' : '',
  }
}

async function renderDocx(fileName: string, templateKey: string, label: string, input: ShareAllotmentInput) {
  const templatePath = await resolveTemplate(fileName)
  const buffer = await fillDocxTemplate(templatePath, allotmentPlaceholders(input))
  return {
    templateKey,
    fileName: downloadName(label, input.companyNameEn, 'docx'),
    buffer,
    mimeType: DOCX_MIME,
  }
}

function presentorName(input: CrPresentor): string {
  return input.presentorNameEn.trim() || input.presentorNameZh.trim()
}

export async function renderNsc1(input: ShareAllotmentInput): Promise<{
  templateKey: string
  fileName: string
  buffer: Buffer
  mimeType: string
}> {
  const brn = crBrn(input.brn || input.companyNo)
  const currency = input.currency.trim() || 'HKD'
  const unpaid = input.amountUnpaidPerShare.trim() || '0'
  const capitalIncrease = input.capitalIncreaseAmount.trim() || input.consideration.trim()
  const buffer = await renderCrPdf('NSC1_Return_of_Allotment.pdf', form => {
    // Page 1 — company, allotment date, totals, cash allotment, presentor
    crPdf.setText(form, 'fill_1_P.1', brn)
    crPdf.setText(form, 'fill_2_P.1', crCompanyName(input.companyNameEn, input.companyNameZh))
    const from = isoDateParts(input.allotmentDate)
    crPdf.setText(form, 'fill_3_P.1', from.day)
    crPdf.setText(form, 'fill_4_P.1', from.month)
    crPdf.setText(form, 'fill_5_P.1', from.year)
    crPdf.checkBox(form, 'cb_1_P.1')
    crPdf.setText(form, 'fill_9_P.1', currency)
    crPdf.setText(form, 'fill_10_P.1', capitalIncrease)
    crPdf.setText(form, 'fill_15_P.1', input.shareClass)
    crPdf.setText(form, 'fill_16_P.1', currency)
    crPdf.setText(form, 'fill_17_P.1', String(input.numberOfShares))
    crPdf.setText(form, 'fill_18_P.1', input.amountPaidPerShare)
    crPdf.setText(form, 'fill_19_P.1', unpaid)
    crPdf.setText(form, 'fill_30_P.1', presentorName(input))
    crPdf.setText(form, 'fill_31_P.1', input.presentorAddress)
    crPdf.setText(form, 'fill_32_P.1', input.presentorTel)
    crPdf.setText(form, 'fill_33_P.1', input.presentorFax)
    crPdf.setText(form, 'fill_34_P.1', input.presentorEmail)
    crPdf.setText(form, 'fill_35_P.1', input.presentorReference)

    // Page 2 / 3 headers
    crPdf.setText(form, 'fill_1_P.2', brn)
    crPdf.setText(form, 'fill_1_P.3', brn)

    // Page 3 — allottees in Schedule 2, statement of capital, signature
    crPdf.checkBox(form, 'cb_1_P.3')
    crPdf.setText(form, 'fill_2_P.3', currency)
    crPdf.setText(form, 'fill_3_P.3', input.shareClass)
    crPdf.setText(form, 'fill_4_P.3', input.issuedTotalNumber.trim() || String(input.numberOfShares))
    crPdf.setText(form, 'fill_5_P.3', input.issuedTotalAmount.trim() || capitalIncrease)
    crPdf.setText(form, 'fill_6_P.3', input.issuedPaidUp.trim() || capitalIncrease)
    crPdf.setText(form, 'fill_7_P.3', input.issuedUnpaid.trim() || '0')
    crPdf.setText(form, 'fill_26_P.3', '1')
    crPdf.setText(form, 'fill_27_P.3', input.signatoryName)
    crPdf.setText(form, 'fill_28_P.3', isoSlashDate(input.signatoryDate))
    crPdf.strikeDropdown(form, input.signatoryCapacity === 'DIRECTOR' ? 'Dropdown2_P.3' : 'Dropdown1_P.3')

    // Schedule 2 (page 7) — one allottee
    crPdf.setText(form, 'fill_1_P.7', brn)
    crPdf.setText(form, 'fill_2_P.7', input.shareClass)
    crPdf.setText(form, 'fill_3_P.7', String(input.numberOfShares))
    if (input.allotteeNameZh.trim()) crPdf.setText(form, 'fill_4_P.7', input.allotteeNameZh)
    crPdf.setText(form, 'fill_7_P.7', input.allotteeName)
    crPdf.setText(form, 'fill_13_P.7', String(input.numberOfShares))
    if (input.allotteeAddress.trim()) crPdf.setText(form, 'fill_8_P.7', input.allotteeAddress)

    for (const page of [4, 5, 6, 8, 9, 10] as const) {
      crPdf.setText(form, `fill_1_P.${page}`, brn)
    }
  })

  return {
    templateKey: 'nsc1',
    fileName: downloadName('NSC1-股份配发申报书', input.companyNameEn, 'pdf'),
    buffer,
    mimeType: PDF_MIME,
  }
}

export async function renderShareAllotmentDocuments(input: ShareAllotmentInput) {
  const [minutes, certificate, application, nsc1] = await Promise.all([
    renderDocx('Board Minutes - Allotment of Shares.docx', 'board-minutes-allotment', '董事会会议纪录-配售新股', input),
    renderDocx('Share Certificate.docx', 'certificate', '新股票', input),
    renderDocx('Share Application Form.docx', 'application', '股份申请表', input),
    renderNsc1(input),
  ])
  return [minutes, certificate, application, nsc1]
}
