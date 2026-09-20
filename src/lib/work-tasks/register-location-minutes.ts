import { REGISTER_ITEMS, type RegisterItemKey } from '@/lib/work-tasks/register-items'
import { renderBoardMinutes } from '@/lib/work-tasks/board-minutes-docx'
import type { RegisterLocationInput } from '@/lib/work-tasks/company-record-change'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const monthName = MONTHS[(month ?? 0) - 1] ?? ''
  return `${day || ''} ${monthName} ${year || ''}`.trim()
}

function locationText(input: RegisterLocationInput): string {
  if (input.location === 'REGISTERED_OFFICE') return 'the registered office of the Company'
  const address = [input.flat, input.building, input.street, input.district].map(part => part.trim()).filter(Boolean)
  return address.length > 0 ? `${address.join(', ')}, Hong Kong` : 'the registered office of the Company'
}

function registerText(keys: RegisterItemKey[]): string {
  const selected = new Set(keys)
  return REGISTER_ITEMS
    .filter(item => selected.has(item.key))
    .map(item => item.en.startsWith('register') ? `the ${item.en}` : item.en)
    .join('; ')
}

export async function renderRegisterLocationMinutes(input: RegisterLocationInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const safeCompany = input.companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  const buffer = await renderBoardMinutes({
    folder: 'register-location',
    templateFile: 'Board Minutes - Location of Registers.docx',
    missingMessage: '找不到登记册备存地点的董事会会议纪录模板：Board Minutes - Location of Registers.docx',
    omitChineseName: !input.companyNameZh.trim(),
    values: {
      '[BR No.]': (input.brn || input.companyNo).trim(),
      '[Company Name (English)]': input.companyNameEn.trim(),
      '[Company Name (Chinese)]': input.companyNameZh.trim(),
      '[Date]': longDate(input.signatoryDate),
      '[Director Name]': input.signatoryName.trim(),
      '[Location]': locationText(input),
      '[Effective Date]': longDate(input.effectiveDate),
      '[Registers]': registerText(input.registers),
    },
  })
  return {
    templateKey: 'board-minutes',
    fileName: `Board Minutes - Location of Registers - ${safeCompany}.docx`.slice(0, 180),
    buffer,
  }
}
