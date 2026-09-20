import { access } from 'node:fs/promises'
import path from 'node:path'
import { fillDocxTemplate, type PlaceholderValue } from '@/lib/work-tasks/fill-docx'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export type CompanyNameChangeInput = {
  companyNameEn: string
  companyNameZh: string
  companyNo: string
  newCompanyNameEn: string
  newCompanyNameZh: string
  changeDate: string
  shareholderNames: string[]
}

export function companyNameChangePlaceholders(input: CompanyNameChangeInput): Record<string, PlaceholderValue> {
  const [year, month, day] = input.changeDate.split('-').map(Number)
  const monthName = MONTHS[month - 1] ?? ''
  const shareholders = [0, 1, 2, 3].map(index => input.shareholderNames[index]?.trim() ?? '')
  return {
    '[Company Name (English)]': input.companyNameEn,
    '[Company Name (Chinese)]': input.companyNameZh,
    '[Company No.]': input.companyNo,
    '[Date]': `${day} ${monthName} ${year}`,
    '[New Company Name (English)]': input.newCompanyNameEn,
    '[New Company Name (Chinese)]': input.newCompanyNameZh,
    '[Shareholder Name 1]': shareholders[0],
    '[Shareholder Name 2]': shareholders[1],
    '[Shareholder Name 3]': shareholders[2],
    '[Shareholder Name 4]': shareholders[3],
  }
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
  const buffer = await fillDocxTemplate(templatePath, companyNameChangePlaceholders(input))
  const safeCompany = input.companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  return {
    templateKey: 'special-resolution',
    fileName: `特别决议-更改公司名称 - ${safeCompany}.docx`.slice(0, 180),
    buffer,
  }
}
