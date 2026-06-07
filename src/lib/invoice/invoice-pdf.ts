import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Invoice, InvoiceLineItem, Company, KeyPerson } from '@prisma/client'

export type InvoicePdfPayload = Invoice & {
  lineItems: InvoiceLineItem[]
  company: Pick<Company, 'nameEn' | 'companyCode' | 'companyNumber'> | null
  keyPerson?: Pick<KeyPerson, 'nameEn' | 'kycCode' | 'idType' | 'idNumber'> | null
}

const ISSUER = {
  name: '6AM Advisory Limited',
  address: 'RM7 20F BOSS COMMERCIAL CENTRE 28 FERRY STREET YAU MA TEI KOWLOON HONG KONG',
  phone: '+852 65600073',
}

const PAYMENT_INFO = {
  bank: 'Bank of China (Hong Kong) Limited',
  swift: 'SWIFT: BKCHHKHH',
  accountNumber: 'Account No.: 01239420444288',
  accountName: 'Account Name: 6AM ADVISORY LIMITED',
  fps: 'FPS#126001833',
}

function safe(s: string | null | undefined): string {
  if (!s) return '-'
  return s
    .replace(/[—–]/g, '-')
    .replace(/·/g, '.')
    .replace(/[^\x00-\xFF]/g, '?')
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(n: { toString(): string } | number, currency: string): string {
  const val = typeof n === 'number' ? n : Number(n.toString())
  return `${currency} ${val.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function invoicePdfFilename(invoice: Pick<Invoice, 'invoiceNumber'>): string {
  return `${safe(invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
}

export async function renderInvoicePdf(invoice: InvoicePdfPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg = await doc.embedFont(StandardFonts.Helvetica)

  const W = 595
  const H = 842
  const ML = 50
  const MR = 50
  const CW = W - ML - MR
  const CONTENT_BOTTOM_Y = 146

  const GOLD = rgb(0.788, 0.663, 0.431)
  const BLACK = rgb(0.1, 0.1, 0.1)
  const GREY = rgb(0.42, 0.37, 0.29)

  let page = doc.addPage([W, H])
  let y = H - 48

  function addPage() {
    page = doc.addPage([W, H])
    y = H - 48
  }

  function ensureSpace(lineHeight = 14) {
    if (y - lineHeight < CONTENT_BOTTOM_Y) addPage()
  }

  function drawText(
    text: string,
    x: number,
    size: number,
    font: typeof reg,
    color = BLACK,
    maxWidth?: number,
  ) {
    const t = safe(text)
    if (maxWidth) {
      let line = ''
      for (const word of t.split(' ')) {
        const test = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          ensureSpace(size + 4)
          page.drawText(line, { x, y, size, font, color })
          y -= size + 4
          line = word
        } else {
          line = test
        }
      }
      if (line) {
        ensureSpace(size + 4)
        page.drawText(line, { x, y, size, font, color })
        y -= size + 4
      }
    } else {
      ensureSpace(size + 6)
      page.drawText(t, { x, y, size, font, color })
      y -= size + 6
    }
  }

  page.drawText('INVOICE', { x: ML, y, size: 22, font: bold, color: GOLD })
  y -= 28

  page.drawText(safe(ISSUER.name), { x: ML, y, size: 10, font: bold, color: BLACK })
  y -= 14
  drawText(ISSUER.address, ML, 9, reg, GREY)
  drawText(ISSUER.phone, ML, 9, reg, GREY)

  const rightX = W - MR
  const metaLines = [
    ['Invoice No.', invoice.invoiceNumber],
    ['Issue date', fmtDate(invoice.issueDate)],
    ['Due date', fmtDate(invoice.dueDate)],
    ['Status', invoice.status],
  ]
  let metaY = H - 76
  for (const [label, value] of metaLines) {
    const lw = bold.widthOfTextAtSize(label, 9)
    page.drawText(label, { x: rightX - 160, y: metaY, size: 9, font: bold, color: GREY })
    page.drawText(safe(value), { x: rightX - lw - 4, y: metaY, size: 9, font: reg, color: BLACK })
    metaY -= 14
  }

  y = Math.min(y, metaY) - 16
  page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness: 0.5, color: GOLD })
  y -= 20

  page.drawText('Bill to', { x: ML, y, size: 10, font: bold, color: GOLD })
  y -= 16
  drawText(invoice.billToName, ML, 10, bold)
  if (invoice.billToAddress) drawText(invoice.billToAddress, ML, 9, reg, GREY, CW / 2)
  if (invoice.billToEmail) drawText(invoice.billToEmail, ML, 9, reg, GREY)

  y -= 8
  const customerRef = (invoice.company
    ? [
        invoice.company.companyCode && `Code: ${invoice.company.companyCode}`,
        invoice.company.companyNumber && `CR No.: ${invoice.company.companyNumber}`,
      ]
    : [
        invoice.keyPerson?.kycCode && `KYC: ${invoice.keyPerson.kycCode}`,
        invoice.keyPerson?.idType && invoice.keyPerson?.idNumber && `${invoice.keyPerson.idType}: ${invoice.keyPerson.idNumber}`,
      ])
    .filter(Boolean)
    .join(' · ')
  if (customerRef) drawText(customerRef, ML, 8, reg, GREY)

  y -= 12
  page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness: 0.5, color: GOLD })
  y -= 22

  const cols = [
    { label: 'Description', x: ML, w: CW * 0.46 },
    { label: 'Qty', x: ML + CW * 0.48, w: CW * 0.1 },
    { label: 'Unit', x: ML + CW * 0.58, w: CW * 0.16 },
    { label: 'Amount', x: ML + CW * 0.76, w: CW * 0.24 },
  ]
  for (const c of cols) {
    page.drawText(c.label, { x: c.x, y, size: 8, font: bold, color: GREY })
  }
  y -= 14
  page.drawLine({ start: { x: ML, y: y + 4 }, end: { x: W - MR, y: y + 4 }, thickness: 0.3, color: GREY })

  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
  for (const line of sorted) {
    ensureSpace(18)
    const qty = Number(line.quantity.toString())
    const unit = Number(line.unitPrice.toString())
    const amt = Number(line.amount.toString())
    page.drawText(safe(line.description), { x: cols[0].x, y, size: 9, font: reg, color: BLACK })
    page.drawText(String(qty), { x: cols[1].x, y, size: 9, font: reg, color: BLACK })
    page.drawText(fmtMoney(unit, ''), { x: cols[2].x, y, size: 9, font: reg, color: BLACK })
    page.drawText(fmtMoney(amt, invoice.currency), { x: cols[3].x, y, size: 9, font: reg, color: BLACK })
    y -= 16
  }

  ensureSpace(84)
  y -= 8
  page.drawLine({ start: { x: ML + CW * 0.5, y }, end: { x: W - MR, y }, thickness: 0.5, color: GOLD })
  y -= 18

  const totals: [string, string][] = [
    ['Subtotal', fmtMoney(invoice.subtotal, invoice.currency)],
    [`Tax (${(Number(invoice.taxRate.toString()) * 100).toFixed(1)}%)`, fmtMoney(invoice.taxAmount, invoice.currency)],
    ['Total', fmtMoney(invoice.total, invoice.currency)],
  ]
  for (const [label, value] of totals) {
    const isTotal = label === 'Total'
    page.drawText(label, {
      x: W - MR - 140,
      y,
      size: isTotal ? 11 : 9,
      font: isTotal ? bold : reg,
      color: isTotal ? GOLD : GREY,
    })
    page.drawText(value, {
      x: W - MR - reg.widthOfTextAtSize(value, isTotal ? 11 : 9),
      y,
      size: isTotal ? 11 : 9,
      font: isTotal ? bold : reg,
      color: BLACK,
    })
    y -= isTotal ? 18 : 14
  }

  if (invoice.notes?.trim()) {
    ensureSpace(46)
    y -= 10
    page.drawText('Notes', { x: ML, y, size: 9, font: bold, color: GREY })
    y -= 14
    drawText(invoice.notes, ML, 9, reg, BLACK, CW)
  }

  const pages = doc.getPages()
  const last = pages[pages.length - 1]
  const paymentLines = [
    PAYMENT_INFO.bank,
    PAYMENT_INFO.swift,
    PAYMENT_INFO.accountNumber,
    PAYMENT_INFO.accountName,
    PAYMENT_INFO.fps,
  ]
  last.drawLine({ start: { x: ML, y: 126 }, end: { x: W - MR, y: 126 }, thickness: 0.5, color: GOLD })
  last.drawText('Payment information', {
    x: ML,
    y: 108,
    size: 9,
    font: bold,
    color: GOLD,
  })
  let paymentY = 94
  for (const line of paymentLines) {
    last.drawText(safe(line), {
      x: ML,
      y: paymentY,
      size: 8,
      font: reg,
      color: GREY,
    })
    paymentY -= 12
  }
  last.drawText('Thank you for your business.', {
    x: W - MR - reg.widthOfTextAtSize('Thank you for your business.', 8),
    y: 36,
    size: 8,
    font: reg,
    color: GREY,
  })

  return doc.save()
}
