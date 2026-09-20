import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'

export type CrPresentor = {
  presentorNameZh: string
  presentorNameEn: string
  presentorAddress: string
  presentorTel: string
  presentorFax: string
  presentorEmail: string
  presentorReference: string
}

export type CrSignatoryCapacity = 'DIRECTOR' | 'COMPANY_SECRETARY' | 'MANAGER' | 'AUTHORIZED_REPRESENTATIVE'

export function crBrn(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function crCompanyName(nameEn: string, nameZh: string): string {
  return [nameEn.trim(), nameZh.trim()].filter(Boolean).join('\n')
}

export function isoDateParts(iso: string): { day: string; month: string; year: string } {
  const [year = '', month = '', day = ''] = iso.split('-')
  return { day, month, year }
}

export function isoSlashDate(iso: string): string {
  const { day, month, year } = isoDateParts(iso)
  return `${day}/${month}/${year}`
}

function forceBlackText(field: { getDefaultAppearance(): string | undefined; setDefaultAppearance(appearance: string): void }) {
  const appearance = field.getDefaultAppearance() ?? ''
  const sizeMatch = appearance.match(/(\d+(?:\.\d+)?)\s+Tf/)
  const parsed = sizeMatch ? Number(sizeMatch[1]) : 12
  const size = parsed > 0 ? parsed : 12
  field.setDefaultAppearance(`0 0 0 rg /F ${size} Tf`)
}

function setText(form: ReturnType<PDFDocument['getForm']>, name: string, value: string) {
  const text = value.trim()
  if (!text) return
  const field = form.getTextField(name)
  if (!field.isMultiline() && field.getMaxLength() != null && text.length > field.getMaxLength()!) {
    field.setMaxLength(text.length)
  }
  field.setText(text)
  forceBlackText(field.acroField)
}

function setDate(form: ReturnType<PDFDocument['getForm']>, dayName: string, monthName: string, yearName: string, iso: string) {
  const { day, month, year } = isoDateParts(iso)
  setText(form, dayName, day)
  setText(form, monthName, month)
  setText(form, yearName, year)
}

function checkBox(form: ReturnType<PDFDocument['getForm']>, name: string) {
  form.getCheckBox(name).check()
}

function strikeDropdown(form: ReturnType<PDFDocument['getForm']>, name: string) {
  const field = form.getDropdown(name)
  const strike = field.getOptions().find(option => option.trim().length > 1)
  if (!strike) return
  field.select(strike)
  forceBlackText(field.acroField)
}

export async function renderCrPdf(fileName: string, fill: (form: ReturnType<PDFDocument['getForm']>) => void): Promise<Buffer> {
  const candidate = path.join(/* turbopackIgnore: true */ process.cwd(), 'CR_Forms', fileName)
  try {
    await access(candidate)
  } catch {
    throw new Error(`找不到公司注册处表格：${fileName}`)
  }
  const doc = await PDFDocument.load(await readFile(candidate))
  const fonts = await loadPdfFonts(doc)
  if (!fonts.supportsUnicode) {
    throw new Error('缺少中文字体，无法填写公司注册处表格。')
  }
  const form = doc.getForm()
  fill(form)
  form.updateFieldAppearances(fonts.regular)
  form.flatten({ updateFieldAppearances: false })
  return Buffer.from(await doc.save())
}

export const crPdf = { setText, setDate, checkBox, strikeDropdown }
