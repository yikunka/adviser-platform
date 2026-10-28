/** Shared Blue Luxury brand constants for SFS invoice PDF / Word. */

import { SFS_ISSUER_EMAIL, SFS_PUBLIC_WEBSITE_HOST } from '@/lib/sfs/sales-contact'

export const SFS_INVOICE_ISSUER = {
  nameEn: 'SFS Technical Group Co., Limited',
  nameZh: '瑞福生科技集團有限公司',
  address: 'RM7 20F BOSS COMMERCIAL CENTRE 28 FERRY STREET YAU MA TEI KOWLOON',
  email: SFS_ISSUER_EMAIL,
  website: SFS_PUBLIC_WEBSITE_HOST,
} as const

export const SFS_INVOICE_PAYMENT = {
  bank: 'DBS BANK (HONG KONG)',
  swift: 'SWIFT: DHBKHKHH',
  bankCode: 'Bank Code: 016',
  accountNumber: 'Account Number: 478002236556',
  accountName: 'A/C Name: SFS TECHNOLOGY GROUP CO., LIMITED',
} as const

/** Hex without # — for docx */
export const SFS_BLUE_LUXURY = {
  navy: '021647',
  gold: 'B39267',
  totalWash: 'EFDAC1',
  ruleSoft: 'D0D0D4',
  white: 'FFFFFF',
} as const

export function sfsFmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function sfsFmtAmount(n: { toString(): string } | number): string {
  const val = typeof n === 'number' ? n : Number(n.toString())
  return val.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function sfsFmtMoney(n: { toString(): string } | number, currency: string): string {
  return `${currency} ${sfsFmtAmount(n)}`
}

export function sfsFmtQty(n: { toString(): string } | number): string {
  const val = typeof n === 'number' ? n : Number(n.toString())
  if (Number.isInteger(val)) return String(val)
  return val.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

export function sfsInvoiceBaseFilename(invoiceNumber: string): string {
  return invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_') || 'sfs-invoice'
}
