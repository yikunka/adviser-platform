export const JMM_COMPANY_NAME = 'JMM Trading Company Limited'

export const JMM_LETTERHEAD = {
  address: 'RM 7 20F Boss Commercial Centre, 28 Ferry Street, Yau Ma Tei, Kowloon, Hong Kong',
  phone: '+852 6560 0073',
  email: 'kennywong@jmmtrading.net',
  website: 'jmmtrading.net',
} as const

export const JMM_BANK = {
  name: 'NANYANG COMMERCIAL BANK, LTD',
  branch: 'KWUN TONG BRANCH',
  lines: ['1F, KWUN TONG VIEW,', '410 KWUN TONG ROAD,', 'KOWLOON, HONG KONG'],
  accountName: 'JMM TRADING COMPANY LIMITED',
  accountNumber: '04348810797468  (HKD ACCOUNT)',
  swift: 'NYCBHKHH',
} as const

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function formatJmmDocDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return `${day} ${MONTHS[month - 1]} ${year}`
}

export function jmmNumberLabel(kind: keyof typeof JMM_DOCUMENT_TITLES): string {
  return kind === 'QUOTATION' ? 'Quotation #' : 'Invoice #'
}

export const JMM_DOCUMENT_TITLES = {
  QUOTATION: 'Quotation',
  PROFORMA: 'Proforma invoice',
  COMMERCIAL_INVOICE: 'Commercial invoice',
} as const
