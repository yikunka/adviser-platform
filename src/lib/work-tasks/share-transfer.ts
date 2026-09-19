import { access } from 'node:fs/promises'
import path from 'node:path'
import { fillDocxTemplate, type PlaceholderValue } from '@/lib/work-tasks/fill-docx'
import { integerToWords } from '@/lib/work-tasks/number-words'
import {
  shareTransferDocument,
  type ShareTransferDocumentKey,
} from '@/lib/work-tasks/share-transfer-docs'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export type ShareTransferParty = {
  name: string
  address: string
  occupation: string
  keyPersonId?: string | null
  companyId?: string | null
  memberId?: string | null
}

export type ShareTransferInput = {
  companyNameEn: string
  companyNameZh: string
  brNo: string
  companyNo: string
  transferDate: string
  transferor: ShareTransferParty
  transferee: ShareTransferParty
  numberOfShares: number
  shareClass: string
  parValue: string
  consideration: string
  shareNumbers: string
  oldCertNo: string
  newCertNo: string
  directorName: string
  paidStatus: 'Fully paid' | 'Partly paid'
  paidAmount: string
  useCommonSeal: boolean
  documents: ShareTransferDocumentKey[]
}

export function shareTransferPlaceholders(input: ShareTransferInput): Record<string, PlaceholderValue> {
  const [year, month, day] = input.transferDate.split('-').map(Number)
  const monthName = MONTHS[month - 1] ?? ''
  const paidAmount = input.paidAmount.trim() || input.consideration.trim()
  return {
    '[Company Name (English)]': input.companyNameEn,
    '[Company Name (Chinese)]': input.companyNameZh,
    '[BR No.]': input.brNo,
    '[Company No.]': input.companyNo,
    '[Date]': `${day} ${monthName} ${year}`,
    '[Day]': String(day),
    '[Month]': monthName,
    '[Year]': String(year),
    '[Transferor Name]': input.transferor.name,
    '[Transferor Address]': input.transferor.address,
    '[Transferee Name]': input.transferee.name,
    '[Transferee Address]': input.transferee.address,
    '[Occupation]': [input.transferee.occupation, input.transferor.occupation],
    '[Number]': String(input.numberOfShares),
    '[Number in words]': integerToWords(input.numberOfShares),
    '[Class]': input.shareClass,
    '[Share Number(s)]': input.shareNumbers,
    '[Amount]': input.consideration,
    '[Par]': input.parValue,
    '[Old Cert No.]': input.oldCertNo,
    '[New Cert No.]': input.newCertNo,
    '[Cert No.]': input.newCertNo,
    '[Director Name]': input.directorName,
    '[Shareholder Name]': input.transferee.name,
    '[Shareholder Address]': input.transferee.address,
    '[Fully paid / Partly paid]': input.paidStatus,
    '[Paid Amount]': paidAmount,
    '[CS Name / 6AM Advisory Limited]': '6AM Advisory Limited',
    '[the Common Seal of the Company / the hand(s) of the authorised signatories]': input.useCommonSeal
      ? 'the Common Seal of the Company'
      : 'the hand(s) of the authorised signatories',
  }
}

export async function resolveShareTransferTemplate(fileName: string): Promise<string> {
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/secretarial/share-transfer', fileName),
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
  throw new Error(`找不到股份转让模板：${fileName}`)
}

function downloadName(label: string, companyName: string): string {
  const safeCompany = companyName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'company'
  return `${label} - ${safeCompany}.docx`.slice(0, 180)
}

export async function renderShareTransferDocuments(input: ShareTransferInput) {
  const values = shareTransferPlaceholders(input)
  const rendered = []
  for (const key of input.documents) {
    const doc = shareTransferDocument(key)
    if (!doc) throw new Error(`未知文件：${key}`)
    const templatePath = await resolveShareTransferTemplate(doc.fileName)
    const buffer = await fillDocxTemplate(templatePath, values)
    rendered.push({
      templateKey: key,
      fileName: downloadName(doc.label, input.companyNameEn),
      buffer,
    })
  }
  return rendered
}
