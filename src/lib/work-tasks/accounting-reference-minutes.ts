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

export async function renderAccountingReferenceMinutes(input: AccountingReferenceInput): Promise<{ templateKey: string; fileName: string; buffer: Buffer }> {
  const safeCompany = input.companyNameEn.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  const reason = input.change === 'EXTEND' && input.extensionReason ? REASON[input.extensionReason] : ''
  const buffer = await renderBoardMinutes({
    folder: 'accounting-reference',
    templateFile: 'Board Minutes - Accounting Reference Date.docx',
    missingMessage: '找不到会计参照日的董事会会议纪录模板：Board Minutes - Accounting Reference Date.docx',
    omitChineseName: !input.companyNameZh.trim(),
    values: {
      '[BR No.]': (input.brn || input.companyNo).trim(),
      '[Company Name (English)]': input.companyNameEn.trim(),
      '[Company Name (Chinese)]': input.companyNameZh.trim(),
      '[Date]': longDate(input.resolutionDate),
      '[Director Name]': input.signatoryName.trim(),
      '[Current Period End]': longDate(input.currentPeriodEnd),
      '[New Period End]': longDate(input.newPeriodEnd),
      '[Change]': input.change === 'EXTEND' ? 'extended' : 'shortened',
      '[Reason]': reason,
    },
  })
  return {
    templateKey: 'board-minutes-ard',
    fileName: `Board Minutes - Accounting Reference Date - ${safeCompany}.docx`.slice(0, 180),
    buffer,
  }
}
