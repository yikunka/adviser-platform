import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { SfsInvoice, SfsInvoiceLineItem, SfsOrder } from '@prisma/client'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'

export type SfsInvoicePdfPayload = SfsInvoice & {
  lineItems: SfsInvoiceLineItem[]
  order: Pick<SfsOrder, 'memorialName' | 'sampleCode' | 'clientName'> | null
}

const ISSUER = {
  nameEn: 'SFS Technical Group Co., Limited',
  nameZh: '瑞福生科技集團有限公司',
  address: 'RM7 20F BOSS COMMERCIAL CENTRE 28 FERRY STREET YAU MA TEI KOWLOON',
  email: 'info@sfsdiamond.com',
  website: 'www.sfsdiamond.com',
}

const PAYMENT_INFO = {
  bank: 'DBS BANK (HONG KONG)',
  swift: 'SWIFT: DHBKHKHH',
  bankCode: 'Bank Code: 016',
  accountNumber: 'Account Number: 478002236556',
  accountName: 'A/C Name: SFS TECHNOLOGY GROUP CO., LIMITED',
}

/** Charcoal / champagne / mid-grey — restrained luxury palette. */
const CHARCOAL = rgb(0.173, 0.173, 0.173) // #2C2C2C
const GOLD = rgb(0.784, 0.663, 0.443) // #C8A971
const MID_GREY = rgb(0.541, 0.541, 0.541) // #8A8A8A
const LIGHT_GREY = rgb(0.72, 0.72, 0.72)
const ROW_TINT = rgb(0.98, 0.98, 0.98) // #FAFAFA
const GOLD_SOFT = rgb(0.95, 0.91, 0.82)

function pdfText(s: string | null | undefined, supportsUnicode: boolean): string {
  if (!s) return '-'
  const normalized = s
    .replace(/[—–]/g, '-')
    .replace(/·/g, '.')
  if (supportsUnicode) return normalized
  return normalized.replace(/[^\x00-\xFF]/g, '?')
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmount(n: { toString(): string } | number): string {
  const val = typeof n === 'number' ? n : Number(n.toString())
  return val.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMoney(n: { toString(): string } | number, currency: string): string {
  return `${currency} ${fmtAmount(n)}`
}

function fmtQty(n: { toString(): string } | number): string {
  const val = typeof n === 'number' ? n : Number(n.toString())
  if (Number.isInteger(val)) return String(val)
  return val.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

/** Accessory / add-on lines render in mid-grey to distinguish from primary diamond lines. */
function isAccessoryLine(description: string): boolean {
  return /\b(fancy\s*shape|chain|jewelry|jewellery|setting|pendant|earring|bracelet)\b/i.test(description)
    && !/\b\d+(\.\d+)?\s*ct\b/i.test(description)
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export function sfsInvoicePdfFilename(invoice: Pick<SfsInvoice, 'invoiceNumber'>): string {
  return `${pdfText(invoice.invoiceNumber, false).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
}

export async function renderSfsInvoicePdf(invoice: SfsInvoicePdfPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const { bold: cjkBold, regular: cjkReg, supportsUnicode } = await loadPdfFonts(doc)
  // Latin faces for hierarchy (Light title / Medium amounts) when CJK font has no weight variants.
  const latinLight = await doc.embedFont(StandardFonts.Helvetica)
  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const body = cjkReg
  const bodyBold = cjkBold

  const W = 595
  const H = 842
  const ML = 50
  const MR = 50
  const CW = W - ML - MR
  const FOOTER_TOP = 138
  const CONTENT_BOTTOM_Y = FOOTER_TOP + 12

  let page = doc.addPage([W, H])
  let y = H - 44

  function ensureSpace(needed: number) {
    if (y - needed < CONTENT_BOTTOM_Y) {
      page = doc.addPage([W, H])
      y = H - 44
      if (invoice.status === 'DRAFT') drawDraftWatermark(page)
    }
  }

  function drawDraftWatermark(target: PDFPage) {
    target.drawText('DRAFT', {
      x: W * 0.22,
      y: H * 0.42,
      size: 72,
      font: latinLight,
      color: GOLD,
      opacity: 0.07,
      rotate: degrees(-28),
    })
  }

  function drawGoldRule(atY: number, fromX = ML, toX = W - MR) {
    page.drawLine({
      start: { x: fromX, y: atY },
      end: { x: toX, y: atY },
      thickness: 0.5,
      color: GOLD,
    })
  }

  function drawRight(
    text: string,
    rightEdge: number,
    atY: number,
    size: number,
    font: PDFFont,
    color = CHARCOAL,
  ) {
    const t = pdfText(text, supportsUnicode)
    const width = font.widthOfTextAtSize(t, size)
    page.drawText(t, { x: rightEdge - width, y: atY, size, font, color })
  }

  if (invoice.status === 'DRAFT') drawDraftWatermark(page)

  // ── Header: brand left + invoice meta right ──────────────────────────────
  const headerTop = y
  page.drawText('INVOICE', {
    x: ML,
    y: headerTop,
    size: 33,
    font: latinLight,
    color: GOLD,
  })

  let brandY = headerTop - 36
  page.drawText(pdfText(ISSUER.nameEn, supportsUnicode), {
    x: ML,
    y: brandY,
    size: 10,
    font: latinBold,
    color: CHARCOAL,
  })
  brandY -= 14
  page.drawText(pdfText(ISSUER.nameZh, supportsUnicode), {
    x: ML,
    y: brandY,
    size: 9,
    font: body,
    color: MID_GREY,
  })
  brandY -= 16

  const brandMaxW = CW * 0.55
  for (const line of wrapLines(ISSUER.address, body, 8, brandMaxW)) {
    page.drawText(pdfText(line, supportsUnicode), {
      x: ML,
      y: brandY,
      size: 8,
      font: body,
      color: MID_GREY,
    })
    brandY -= 11
  }
  page.drawText(pdfText(ISSUER.email, supportsUnicode), {
    x: ML,
    y: brandY,
    size: 8,
    font: body,
    color: MID_GREY,
  })
  brandY -= 12

  const metaLabelX = W - MR - 168
  const metaValueRight = W - MR
  let metaY = headerTop - 4
  const metaRows: Array<{ label: string; value: string; status?: boolean }> = [
    { label: 'Invoice No.', value: invoice.invoiceNumber },
    { label: 'Issue date', value: fmtDate(invoice.issueDate) },
    { label: 'Status', value: invoice.status, status: true },
  ]
  for (const row of metaRows) {
    page.drawText(row.label, {
      x: metaLabelX,
      y: metaY,
      size: 8,
      font: latinLight,
      color: MID_GREY,
    })
    if (row.status) {
      const badgeSize = 8
      const padX = 7
      const padY = 3
      const label = pdfText(row.value, false)
      const tw = latinBold.widthOfTextAtSize(label, badgeSize)
      const boxW = tw + padX * 2
      const boxH = badgeSize + padY * 2
      const boxX = metaValueRight - boxW
      const boxY = metaY - padY + 1
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        color: GOLD_SOFT,
      })
      page.drawText(label, {
        x: boxX + padX,
        y: metaY,
        size: badgeSize,
        font: latinBold,
        color: GOLD,
      })
    } else {
      drawRight(row.value, metaValueRight, metaY, 9, latinBold, CHARCOAL)
    }
    metaY -= 16
  }

  y = Math.min(brandY, metaY) - 10
  drawGoldRule(y)
  y -= 22

  // ── Bill to ──────────────────────────────────────────────────────────────
  page.drawText('BILL TO', {
    x: ML,
    y,
    size: 8,
    font: latinLight,
    color: GOLD,
  })
  y -= 16

  page.drawText(pdfText(invoice.billToName, supportsUnicode), {
    x: ML,
    y,
    size: 12,
    font: bodyBold,
    color: CHARCOAL,
  })
  y -= 15

  const contactLines = [
    invoice.billToPhone,
    ...(invoice.billToAddress
      ? wrapLines(pdfText(invoice.billToAddress, supportsUnicode), body, 9, CW * 0.62)
      : []),
    invoice.billToEmail,
  ].filter((v): v is string => Boolean(v && String(v).trim()))

  for (const line of contactLines) {
    ensureSpace(12)
    page.drawText(pdfText(line, supportsUnicode), {
      x: ML,
      y,
      size: 9,
      font: body,
      color: MID_GREY,
    })
    y -= 12
  }

  if (invoice.order?.sampleCode || invoice.order?.memorialName) {
    y -= 6
    ensureSpace(28)
    const barH = 22
    const barY = y - 6
    page.drawRectangle({
      x: ML,
      y: barY,
      width: CW,
      height: barH,
      color: ROW_TINT,
    })
    const sample = invoice.order.sampleCode
      ? `Sample ID: ${invoice.order.sampleCode}`
      : null
    const memorial = invoice.order.memorialName
      ? `Memorial: ${invoice.order.memorialName}`
      : null
    const barText = [sample, memorial].filter(Boolean).join('   |   ')
    page.drawText(pdfText(barText, supportsUnicode), {
      x: ML + 10,
      y: barY + 7,
      size: 8,
      font: body,
      color: CHARCOAL,
    })
    y = barY - 14
  } else {
    y -= 8
  }

  ensureSpace(20)
  drawGoldRule(y)
  y -= 20

  // ── Line items table ─────────────────────────────────────────────────────
  const colDesc = { x: ML, w: CW * 0.6 }
  const colQty = { right: ML + CW * 0.7, w: CW * 0.1 }
  const colUnit = { right: ML + CW * 0.85, w: CW * 0.15 }
  const colAmt = { right: W - MR, w: CW * 0.15 }

  page.drawText('DESCRIPTION', {
    x: colDesc.x,
    y,
    size: 8,
    font: latinLight,
    color: GOLD,
  })
  drawRight('QTY', colQty.right, y, 8, latinLight, GOLD)
  drawRight('UNIT', colUnit.right, y, 8, latinLight, GOLD)
  drawRight('AMOUNT', colAmt.right, y, 8, latinLight, GOLD)
  y -= 6
  drawGoldRule(y)
  y -= 14

  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
  sorted.forEach((line, index) => {
    const desc = pdfText(line.description, supportsUnicode)
    const descLines = wrapLines(desc, body, 9, colDesc.w - 4)
    const rowH = Math.max(18, descLines.length * 12 + 6)
    ensureSpace(rowH + 4)

    if (index % 2 === 1) {
      page.drawRectangle({
        x: ML,
        y: y - rowH + 12,
        width: CW,
        height: rowH,
        color: ROW_TINT,
      })
    }

    const accessory = isAccessoryLine(line.description)
    const descColor = accessory ? MID_GREY : CHARCOAL
    const numColor = accessory ? MID_GREY : CHARCOAL
    let textY = y
    for (const part of descLines) {
      page.drawText(part, {
        x: colDesc.x,
        y: textY,
        size: 9,
        font: body,
        color: descColor,
      })
      textY -= 12
    }

    const qty = fmtQty(line.quantity)
    const unit = fmtAmount(line.unitPrice)
    const amt = fmtAmount(line.amount)
    drawRight(qty, colQty.right, y, 9, latinLight, numColor)
    drawRight(unit, colUnit.right, y, 9, latinLight, numColor)
    drawRight(amt, colAmt.right, y, 9, latinBold, CHARCOAL)

    y -= rowH
  })

  // ── Totals (align to Amount column) ──────────────────────────────────────
  y -= 6
  ensureSpace(48)
  const totalLabelX = colUnit.right - 72

  page.drawText('Subtotal', {
    x: totalLabelX,
    y,
    size: 9,
    font: latinLight,
    color: MID_GREY,
  })
  drawRight(fmtMoney(invoice.subtotal, invoice.currency), colAmt.right, y, 9, latinLight, MID_GREY)
  y -= 12

  drawGoldRule(y, totalLabelX - 8, W - MR)
  y -= 16

  page.drawText('TOTAL', {
    x: totalLabelX,
    y,
    size: 10,
    font: latinLight,
    color: GOLD,
  })
  drawRight(fmtMoney(invoice.total, invoice.currency), colAmt.right, y, 12, latinBold, CHARCOAL)
  y -= 20

  if (invoice.notes?.trim()) {
    ensureSpace(40)
    y -= 4
    page.drawText('NOTES', {
      x: ML,
      y,
      size: 8,
      font: latinLight,
      color: GOLD,
    })
    y -= 12
    for (const part of wrapLines(pdfText(invoice.notes, supportsUnicode), body, 9, CW)) {
      ensureSpace(12)
      page.drawText(part, { x: ML, y, size: 9, font: body, color: CHARCOAL })
      y -= 12
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = doc.getPages()
  const totalPages = pages.length
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: ML, y: FOOTER_TOP },
      end: { x: W - MR, y: FOOTER_TOP },
      thickness: 0.5,
      color: GOLD,
    })

    p.drawText('PAYMENT INFORMATION', {
      x: ML,
      y: FOOTER_TOP - 16,
      size: 8,
      font: latinLight,
      color: GOLD,
    })

    const paymentLines = [
      PAYMENT_INFO.bank,
      `${PAYMENT_INFO.swift}  ·  ${PAYMENT_INFO.bankCode}`,
      PAYMENT_INFO.accountNumber,
      PAYMENT_INFO.accountName,
    ]
    let payY = FOOTER_TOP - 30
    for (const line of paymentLines) {
      p.drawText(pdfText(line, supportsUnicode), {
        x: ML,
        y: payY,
        size: 7.5,
        font: body,
        color: MID_GREY,
      })
      payY -= 11
    }

    const thanks = 'Thank you for your business.'
    const thanksW = latinLight.widthOfTextAtSize(thanks, 8)
    p.drawText(thanks, {
      x: (W - thanksW) / 2,
      y: 28,
      size: 8,
      font: latinLight,
      color: LIGHT_GREY,
    })

    const pageLabel = `Page ${idx + 1}/${totalPages}`
    const pageW = latinLight.widthOfTextAtSize(pageLabel, 8)
    p.drawText(pageLabel, {
      x: W - MR - pageW,
      y: 28,
      size: 8,
      font: latinLight,
      color: LIGHT_GREY,
    })

    p.drawText(ISSUER.website, {
      x: ML,
      y: 28,
      size: 7,
      font: latinLight,
      color: LIGHT_GREY,
    })
  })

  return doc.save()
}
