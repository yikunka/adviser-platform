import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import type { Invoice, InvoiceLineItem, Company, KeyPerson } from '@prisma/client'
import { tcspCustomerLevelLabel } from '@/lib/adviser/tcsp-pricing'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'

export type InvoicePdfLine = InvoiceLineItem & {
  tcspServicePrice?: {
    jurisdiction: string
    customerLevel: string
    serviceContent: string
  } | null
}

export type InvoicePdfPayload = Invoice & {
  lineItems: InvoicePdfLine[]
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

function lineDescriptionText(line: InvoicePdfLine): string {
  const price = line.tcspServicePrice
  const serviceLabel = price
    ? [price.jurisdiction, tcspCustomerLevelLabel(price.customerLevel), price.serviceContent]
        .map(part => part.trim())
        .filter(Boolean)
        .join(' / ')
    : ''
  const description = (line.description ?? '').trim()
  if (!serviceLabel) return description
  if (!description || description === price?.serviceContent.trim() || description === serviceLabel) return serviceLabel
  return `${serviceLabel}\n${description}`
}

export async function renderInvoicePdf(invoice: InvoicePdfPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts = await loadPdfFonts(doc)
  const bold = fonts.bold
  const reg = fonts.regular
  const keepUnicode = fonts.supportsUnicode

  function textOf(value: string | null | undefined): string {
    if (!value) return '-'
    const normalized = value.replace(/[—–]/g, '-').replace(/·/g, '.')
    return keepUnicode ? normalized : normalized.replace(/[^\x00-\xFF]/g, '?')
  }

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
    const t = textOf(text)
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
  drawText(ISSUER.address, ML, 9, reg, GREY, CW * 0.55)
  drawText(ISSUER.phone, ML, 9, reg, GREY)

  const rightX = W - MR
  const metaLines = [
    ['Invoice No.', invoice.invoiceNumber],
    ['Issue date', fmtDate(invoice.issueDate)],
    ['Due date', fmtDate(invoice.dueDate)],
    ['Status', invoice.status],
  ]
  const metaLabelX = rightX - 180
  const metaValueRightX = rightX
  let metaY = H - 76
  for (const [label, value] of metaLines) {
    const renderedValue = textOf(value)
    const valueWidth = reg.widthOfTextAtSize(renderedValue, 9)
    page.drawText(label, { x: metaLabelX, y: metaY, size: 9, font: bold, color: GREY })
    page.drawText(renderedValue, { x: metaValueRightX - valueWidth, y: metaY, size: 9, font: reg, color: BLACK })
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
  y -= 18

  const gap = 4
  const fixed = { no: 22, unit: 86, discountType: 72, discountValue: 78, amount: 82 }
  const descW = CW - gap * 5 - fixed.no - fixed.unit - fixed.discountType - fixed.discountValue - fixed.amount
  const cols: { label: string; w: number; x: number; align: 'left' | 'right' }[] = [
    { label: 'No.', w: fixed.no, x: 0, align: 'left' },
    { label: 'TCSP service price', w: descW, x: 0, align: 'left' },
    { label: 'Unit price', w: fixed.unit, x: 0, align: 'left' },
    { label: 'Discount type', w: fixed.discountType, x: 0, align: 'left' },
    { label: 'Discount value', w: fixed.discountValue, x: 0, align: 'right' },
    { label: 'Amount', w: fixed.amount, x: 0, align: 'right' },
  ]
  let colX = ML
  for (const col of cols) {
    col.x = colX
    let headerSize = 7.5
    while (headerSize > 6 && bold.widthOfTextAtSize(col.label, headerSize) > col.w) headerSize -= 0.25
    const headerWidth = bold.widthOfTextAtSize(col.label, headerSize)
    const headerX = col.align === 'right' ? col.x + col.w - headerWidth : col.x
    page.drawText(col.label, { x: headerX, y, size: headerSize, font: bold, color: GREY })
    colX += col.w + gap
  }
  y -= 10
  page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness: 0.3, color: GREY })
  y -= 14

  function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
    const source = textOf(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
    if (!source || source === '-') return []
    const lines: string[] = []
    let current = ''
    for (const ch of source) {
      if (ch === '\n') {
        if (current.trim()) lines.push(current.trim())
        current = ''
        continue
      }
      const next = current + ch
      if (font.widthOfTextAtSize(next, size) > maxWidth && current.trim()) {
        lines.push(current.trim())
        current = ch.trim()
      } else {
        current = next
      }
    }
    if (current.trim()) lines.push(current.trim())
    return lines
  }

  function drawFitted(text: string, x: number, atY: number, size: number, font: PDFFont, maxWidth: number) {
    const rendered = textOf(text)
    if (!rendered || rendered === '-') return
    let drawSize = size
    while (drawSize > 6 && font.widthOfTextAtSize(rendered, drawSize) > maxWidth) drawSize -= 0.5
    page.drawText(rendered, { x, y: atY, size: drawSize, font, color: BLACK })
  }

  function drawRight(text: string, right: number, atY: number, size: number, font: PDFFont, maxWidth: number) {
    const rendered = textOf(text)
    if (!rendered || rendered === '-') return
    let drawSize = size
    while (drawSize > 6 && font.widthOfTextAtSize(rendered, drawSize) > maxWidth) drawSize -= 0.5
    page.drawText(rendered, {
      x: right - font.widthOfTextAtSize(rendered, drawSize),
      y: atY,
      size: drawSize,
      font,
      color: BLACK,
    })
  }

  function discountTypeLabel(type: InvoiceLineItem['discountType'], value: number) {
    if (!type || !Number.isFinite(value) || value <= 0) return ''
    if (type === 'PERCENT') return 'Percent'
    if (type === 'FIXED') return 'Fixed'
    return ''
  }

  function discountValueLabel(line: InvoiceLineItem) {
    const value = line.discountValue == null ? 0 : Number(line.discountValue.toString())
    if (!line.discountType || !Number.isFinite(value) || value <= 0) return ''
    if (line.discountType === 'PERCENT') return `${value.toFixed(2)}%`
    return fmtMoney(value, invoice.currency)
  }

  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
  sorted.forEach((line, index) => {
    const descLines = wrapToWidth(lineDescriptionText(line), reg, 8, cols[1].w)
    const rowHeight = Math.max(16, Math.max(descLines.length, 1) * 11 + 4)
    ensureSpace(rowHeight)
    const rowTop = y
    const discountValue = line.discountValue == null ? 0 : Number(line.discountValue.toString())
    page.drawText(String(index + 1), { x: cols[0].x, y: rowTop, size: 8, font: reg, color: BLACK })
    descLines.forEach((descLine, lineIndex) => {
      try {
        page.drawText(descLine, { x: cols[1].x, y: rowTop - lineIndex * 11, size: 8, font: reg, color: BLACK })
      } catch {
        const fallback = descLine.replace(/[^\x00-\xFF]/g, '?')
        if (fallback.trim()) {
          page.drawText(fallback, { x: cols[1].x, y: rowTop - lineIndex * 11, size: 8, font: reg, color: BLACK })
        }
      }
    })
    drawFitted(fmtMoney(line.unitPrice, invoice.currency), cols[2].x, rowTop, 8, reg, cols[2].w)
    drawFitted(discountTypeLabel(line.discountType, discountValue), cols[3].x, rowTop, 8, reg, cols[3].w)
    drawRight(discountValueLabel(line), cols[4].x + cols[4].w, rowTop, 8, reg, cols[4].w)
    drawRight(fmtMoney(line.amount, invoice.currency), cols[5].x + cols[5].w, rowTop, 8, reg, cols[5].w)
    y = rowTop - rowHeight
  })

  ensureSpace(36)
  y -= 4
  page.drawLine({ start: { x: ML + CW * 0.5, y }, end: { x: W - MR, y }, thickness: 0.5, color: GOLD })
  y -= 18

  const totalLabel = 'Total'
  const totalValue = fmtMoney(invoice.total, invoice.currency)
  page.drawText(totalLabel, { x: W - MR - 140, y, size: 11, font: bold, color: GOLD })
  drawRight(totalValue, W - MR, y, 11, bold, 120)
  y -= 16

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
    last.drawText(textOf(line), {
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
