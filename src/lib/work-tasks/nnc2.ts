import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'
import type { CompanyNameChangeInput } from '@/lib/work-tasks/company-name-change'

const STRIKE = '—'

export type Nnc2Values = {
  brn: string
  existingNameEn: string
  existingNameZh: string
  resolutionDay: string
  resolutionMonth: string
  resolutionYear: string
  intendedNameEn: string
  intendedNameZh: string
  signatoryName: string
  signatoryCapacity: 'DIRECTOR' | 'COMPANY_SECRETARY'
  signatoryDate: string
  presentorNameZh: string
  presentorNameEn: string
  presentorAddress: string
  presentorTel: string
  presentorFax: string
  presentorEmail: string
  presentorReference: string
}

/** A missing language is NIL. A blank new name keeps the existing name in that language. */
export function nnc2LanguageName(entered: string, kept: string): string {
  const next = entered.trim()
  if (next) return next
  const current = kept.trim()
  return current || 'NIL'
}

/** Form NNC2 asks for the first 8 digits of the business registration number. */
export function nnc2Brn(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function nnc2Values(input: CompanyNameChangeInput): Nnc2Values {
  const [year, month, day] = input.changeDate.split('-')
  const [signYear, signMonth, signDay] = input.signatoryDate.split('-')
  return {
    brn: nnc2Brn(input.brn || input.companyNo),
    existingNameEn: nnc2LanguageName(input.companyNameEn, ''),
    existingNameZh: nnc2LanguageName(input.companyNameZh, ''),
    resolutionDay: day ?? '',
    resolutionMonth: month ?? '',
    resolutionYear: year ?? '',
    intendedNameEn: nnc2LanguageName(input.newCompanyNameEn, input.companyNameEn),
    intendedNameZh: nnc2LanguageName(input.newCompanyNameZh, input.companyNameZh),
    signatoryName: input.signatoryName.trim(),
    signatoryCapacity: input.signatoryCapacity,
    signatoryDate: `${signDay}/${signMonth}/${signYear}`,
    presentorNameZh: input.presentorNameZh.trim(),
    presentorNameEn: input.presentorNameEn.trim(),
    presentorAddress: input.presentorAddress.trim(),
    presentorTel: input.presentorTel.trim(),
    presentorFax: input.presentorFax.trim(),
    presentorEmail: input.presentorEmail.trim(),
    presentorReference: input.presentorReference.trim(),
  }
}

async function resolveNnc2Template(): Promise<string> {
  const candidate = path.join(/* turbopackIgnore: true */ process.cwd(), 'CR_Forms/NNC2_Change_of_Company_Name.pdf')
  try {
    await access(candidate)
  } catch {
    throw new Error('找不到公司注册处表格 NNC2。')
  }
  return candidate
}

function setText(form: ReturnType<PDFDocument['getForm']>, name: string, value: string) {
  if (!value) return
  const field = form.getTextField(name)
  if (!field.isMultiline() && field.getMaxLength() != null && value.length > field.getMaxLength()!) {
    field.setMaxLength(value.length)
  }
  field.setText(value)
  forceBlackText(field.acroField)
}

/** Readers redraw live form values in blue. RGB black is baked into the appearance. */
function forceBlackText(field: { getDefaultAppearance(): string | undefined; setDefaultAppearance(appearance: string): void }) {
  const appearance = field.getDefaultAppearance() ?? ''
  const sizeMatch = appearance.match(/(\d+(?:\.\d+)?)\s+Tf/)
  const parsed = sizeMatch ? Number(sizeMatch[1]) : 12
  const size = parsed > 0 ? parsed : 12
  field.setDefaultAppearance(`0 0 0 rg /F ${size} Tf`)
}

function strikeCapacity(form: ReturnType<PDFDocument['getForm']>, capacity: Nnc2Values['signatoryCapacity']) {
  const fieldName = capacity === 'DIRECTOR' ? 'Dropdown_2_P.1' : 'Dropdown_1_P.1'
  const field = form.getDropdown(fieldName)
  const strike = field.getOptions().find(option => option.includes(STRIKE) || option.includes('-'))
  if (strike) field.select(strike)
  forceBlackText(field.acroField)
}

export async function renderNnc2(input: CompanyNameChangeInput): Promise<Buffer> {
  const values = nnc2Values(input)
  const doc = await PDFDocument.load(await readFile(await resolveNnc2Template()))
  const fonts = await loadPdfFonts(doc)
  if (!fonts.supportsUnicode) {
    throw new Error('缺少中文字体，无法填写表格 NNC2。')
  }
  const form = doc.getForm()
  setText(form, 'fill_1_P.1', values.brn)
  setText(form, 'fill_2_P.1', values.existingNameEn)
  setText(form, 'fill_3_P.1', values.existingNameZh)
  setText(form, 'fill_4_P.1', values.resolutionDay)
  setText(form, 'fill_5_P.1', values.resolutionMonth)
  setText(form, 'fill_6_P.1', values.resolutionYear)
  setText(form, 'fill_7_P.1', values.intendedNameEn)
  setText(form, 'fill_8_P.1', values.intendedNameZh)
  setText(form, 'fill_9_P.1', values.signatoryName)
  strikeCapacity(form, values.signatoryCapacity)
  setText(form, 'fill_10_P.1', values.signatoryDate)
  setText(form, 'fill_11_P.1', values.presentorNameZh)
  setText(form, 'fill_12_P.1', values.presentorNameEn)
  setText(form, 'fill_13_P.1', values.presentorAddress)
  setText(form, 'fill_14_P.1', values.presentorTel)
  setText(form, 'fill_15_P.1', values.presentorFax)
  setText(form, 'fill_16_P.1', values.presentorEmail)
  setText(form, 'fill_17_P.1', values.presentorReference)
  form.updateFieldAppearances(fonts.regular)
  form.flatten({ updateFieldAppearances: false })
  return Buffer.from(await doc.save())
}

export function nnc2FileName(companyNameEn: string): string {
  const safeCompany = companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  return `NNC2-更改公司名称 - ${safeCompany}.pdf`.slice(0, 180)
}
