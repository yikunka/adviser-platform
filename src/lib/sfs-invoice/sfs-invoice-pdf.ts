import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { SfsInvoice, SfsInvoiceLineItem, SfsOrder } from '@prisma/client'
import { loadSfsInvoiceFonts } from '@/lib/sfs-invoice/sfs-invoice-fonts'

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

/** Soft art-paper luxury palette */
const PAPER = rgb(0.969, 0.957, 0.937) // #F7F4EF
const INK = rgb(0.192, 0.18, 0.165) // #312E2A
const GOLD = rgb(0.706, 0.58, 0.361) // #B4945C
const WARM_GREY = rgb(0.525, 0.51, 0.486) // #86827C
const GOLD_SOFT = rgb(0.945, 0.918, 0.855) // soft champagne wash
const ROW_TINT = rgb(0.961, 0.949, 0.929)

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

/** Draw text with generous tracking (em fraction between glyphs). */
function drawTracked(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  trackingEm: number,
): number {
  let cursor = x
  const gap = size * trackingEm
  for (const ch of text) {
    page.drawText(ch, { x: cursor, y, size, font, color })
    cursor += font.widthOfTextAtSize(ch, size) + gap
  }
  return cursor - x - (text.length ? gap : 0)
}

function trackedWidth(text: string, size: number, font: PDFFont, trackingEm: number): number {
  if (!text) return 0
  const gap = size * trackingEm
  let w = 0
  for (const ch of text) w += font.widthOfTextAtSize(ch, size)
  return w + gap * Math.max(0, text.length - 1)
}

/** Faux small-caps: uppercase at ~82% size with light tracking. */
function drawSmallCaps(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  drawTracked(page, text.toUpperCase(), x, y, size * 0.82, font, color, 0.14)
}

export function sfsInvoicePdfFilename(invoice: Pick<SfsInvoice, 'invoiceNumber'>): string {
  return `${pdfText(invoice.invoiceNumber, false).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
}

export async function renderSfsInvoicePdf(invoice: SfsInvoicePdfPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts = await loadSfsInvoiceFonts(doc)
  const { display, section, body, amount, cjk, supportsUnicode } = fonts

  // ~1.5× previous 50pt margins for a quieter, more expensive page.
  const W = 595
  const H = 842
  const ML = 72
  const MR = 72
  const CW = W - ML - MR
  const FOOTER_TOP = 152
  const CONTENT_BOTTOM_Y = FOOTER_TOP + 14
  const BODY_SIZE = 10
  const BODY_LEADING = BODY_SIZE * 1.4

  let page = doc.addPage([W, H])
  let y = H - 64

  function paintPaper(target: PDFPage) {
    target.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })
  }

  function drawDraftWatermark(target: PDFPage) {
    target.drawText('DRAFT', {
      x: W * 0.2,
      y: H * 0.4,
      size: 78,
      font: display,
      color: GOLD,
      opacity: 0.055,
      rotate: degrees(-28),
    })
  }

  function preparePage(target: PDFPage) {
    paintPaper(target)
    if (invoice.status === 'DRAFT') drawDraftWatermark(target)
  }

  function ensureSpace(needed: number) {
    if (y - needed < CONTENT_BOTTOM_Y) {
      page = doc.addPage([W, H])
      preparePage(page)
      y = H - 64
    }
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
    color = INK,
  ) {
    const t = pdfText(text, supportsUnicode)
    const width = font.widthOfTextAtSize(t, size)
    page.drawText(t, { x: rightEdge - width, y: atY, size, font, color })
  }

  preparePage(page)

  // ── Header ───────────────────────────────────────────────────────────────
  const headerTop = y
  const title = 'INVOICE'
  const titleSize = 36
  const titleTracking = 0.2
  drawTracked(page, title, ML, headerTop, titleSize, display, GOLD, titleTracking)

  let brandY = headerTop - 40
  page.drawText(pdfText(ISSUER.nameEn, supportsUnicode), {
    x: ML,
    y: brandY,
    size: 11,
    font: amount,
    color: INK,
  })
  brandY -= 15
  page.drawText(pdfText(ISSUER.nameZh, supportsUnicode), {
    x: ML,
    y: brandY,
    size: 9,
    font: cjk,
    color: WARM_GREY,
  })
  brandY -= 18

  const brandMaxW = CW * 0.52
  for (const line of wrapLines(ISSUER.address, body, 8, brandMaxW)) {
    page.drawText(pdfText(line, supportsUnicode), {
      x: ML,
      y: brandY,
      size: 8,
      font: body,
      color: WARM_GREY,
    })
    brandY -= 11
  }
  page.drawText(pdfText(ISSUER.email, supportsUnicode), {
    x: ML,
    y: brandY,
    size: 8,
    font: body,
    color: WARM_GREY,
  })
  brandY -= 14

  const metaLabelX = W - MR - 175
  const metaValueRight = W - MR
  let metaY = headerTop - 2
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
      font: section,
      color: WARM_GREY,
    })
    if (row.status) {
      const badgeSize = 8
      const padX = 8
      const padY = 3.5
      const label = pdfText(row.value, false)
      const tw = amount.widthOfTextAtSize(label, badgeSize)
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
        font: amount,
        color: GOLD,
      })
    } else {
      drawRight(row.value, metaValueRight, metaY, 10, amount, INK)
    }
    metaY -= 18
  }

  y = Math.min(brandY, metaY) - 12
  drawGoldRule(y)
  y -= 26

  // ── Bill to ──────────────────────────────────────────────────────────────
  drawSmallCaps(page, 'Bill to', ML, y, 10, section, GOLD)
  y -= 18

  page.drawText(pdfText(invoice.billToName, supportsUnicode), {
    x: ML,
    y,
    size: 13,
    font: amount,
    color: INK,
  })
  y -= BODY_LEADING + 2

  const contactLines = [
    invoice.billToPhone,
    ...(invoice.billToAddress
      ? wrapLines(pdfText(invoice.billToAddress, supportsUnicode), body, BODY_SIZE, CW * 0.62)
      : []),
    invoice.billToEmail,
  ].filter((v): v is string => Boolean(v && String(v).trim()))

  for (const line of contactLines) {
    ensureSpace(BODY_LEADING)
    page.drawText(pdfText(line, supportsUnicode), {
      x: ML,
      y,
      size: BODY_SIZE,
      font: body,
      color: WARM_GREY,
    })
    y -= BODY_LEADING
  }

  if (invoice.order?.sampleCode || invoice.order?.memorialName) {
    y -= 8
    ensureSpace(32)
    const barH = 24
    const barY = y - 8
    page.drawRectangle({
      x: ML,
      y: barY,
      width: CW,
      height: barH,
      color: GOLD_SOFT,
    })
    const sample = invoice.order.sampleCode
      ? `Sample ID: ${invoice.order.sampleCode}`
      : null
    const memorial = invoice.order.memorialName
      ? `Memorial: ${invoice.order.memorialName}`
      : null
    const barText = [sample, memorial].filter(Boolean).join('    |    ')
    page.drawText(pdfText(barText, supportsUnicode), {
      x: ML + 12,
      y: barY + 8,
      size: 9,
      font: amount,
      color: INK,
    })
    y = barY - 18
  } else {
    y -= 10
  }

  ensureSpace(22)
  drawGoldRule(y)
  y -= 24

  // ── Line items ───────────────────────────────────────────────────────────
  const colDesc = { x: ML, w: CW * 0.6 }
  const colQty = { right: ML + CW * 0.7 }
  const colUnit = { right: ML + CW * 0.85 }
  const colAmt = { right: W - MR }

  drawSmallCaps(page, 'Description', colDesc.x, y, 9, section, GOLD)
  // right-aligned small-caps headers
  const qtyLabel = 'QTY'
  const unitLabel = 'UNIT'
  const amtLabel = 'AMOUNT'
  const scSize = 9 * 0.82
  drawTracked(
    page,
    qtyLabel,
    colQty.right - trackedWidth(qtyLabel, scSize, section, 0.14),
    y,
    scSize,
    section,
    GOLD,
    0.14,
  )
  drawTracked(
    page,
    unitLabel,
    colUnit.right - trackedWidth(unitLabel, scSize, section, 0.14),
    y,
    scSize,
    section,
    GOLD,
    0.14,
  )
  drawTracked(
    page,
    amtLabel,
    colAmt.right - trackedWidth(amtLabel, scSize, section, 0.14),
    y,
    scSize,
    section,
    GOLD,
    0.14,
  )
  y -= 8
  drawGoldRule(y)
  y -= 16

  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
  sorted.forEach((line, index) => {
    const desc = pdfText(line.description, supportsUnicode)
    const descLines = wrapLines(desc, body, BODY_SIZE, colDesc.w - 4)
    const rowH = Math.max(BODY_LEADING * 1.3 + 4, descLines.length * BODY_LEADING + 8)
    ensureSpace(rowH + 4)

    if (index % 2 === 1) {
      page.drawRectangle({
        x: ML,
        y: y - rowH + BODY_SIZE,
        width: CW,
        height: rowH,
        color: ROW_TINT,
      })
    }

    const accessory = isAccessoryLine(line.description)
    const descColor = accessory ? WARM_GREY : INK
    const numColor = accessory ? WARM_GREY : INK
    let textY = y
    for (const part of descLines) {
      page.drawText(part, {
        x: colDesc.x,
        y: textY,
        size: BODY_SIZE,
        font: body,
        color: descColor,
      })
      textY -= BODY_LEADING
    }

    drawRight(fmtQty(line.quantity), colQty.right, y, BODY_SIZE, amount, numColor)
    drawRight(fmtAmount(line.unitPrice), colUnit.right, y, BODY_SIZE, amount, numColor)
    drawRight(fmtAmount(line.amount), colAmt.right, y, BODY_SIZE, amount, INK)

    y -= rowH
  })

  // ── Totals ───────────────────────────────────────────────────────────────
  y -= 8
  ensureSpace(56)
  const totalLabelX = colUnit.right - 80

  page.drawText('Subtotal', {
    x: totalLabelX,
    y,
    size: 10,
    font: body,
    color: WARM_GREY,
  })
  drawRight(fmtMoney(invoice.subtotal, invoice.currency), colAmt.right, y, 10, body, WARM_GREY)
  y -= 14

  drawGoldRule(y, totalLabelX - 10, W - MR)
  y -= 18

  drawSmallCaps(page, 'Total', totalLabelX, y, 11, section, GOLD)
  drawRight(fmtMoney(invoice.total, invoice.currency), colAmt.right, y, 14, amount, INK)
  y -= 22

  if (invoice.notes?.trim()) {
    ensureSpace(44)
    y -= 4
    drawSmallCaps(page, 'Notes', ML, y, 9, section, GOLD)
    y -= 14
    for (const part of wrapLines(pdfText(invoice.notes, supportsUnicode), body, BODY_SIZE, CW)) {
      ensureSpace(BODY_LEADING)
      page.drawText(part, { x: ML, y, size: BODY_SIZE, font: body, color: INK })
      y -= BODY_LEADING
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

    // Soft cream panel behind payment block
    p.drawRectangle({
      x: ML,
      y: 40,
      width: CW,
      height: FOOTER_TOP - 48,
      color: GOLD_SOFT,
      opacity: 0.45,
    })

    drawSmallCaps(p, 'Payment information', ML + 10, FOOTER_TOP - 18, 9, section, GOLD)

    const paymentLines = [
      PAYMENT_INFO.bank,
      `${PAYMENT_INFO.swift}  ·  ${PAYMENT_INFO.bankCode}`,
      PAYMENT_INFO.accountNumber,
      PAYMENT_INFO.accountName,
    ]
    let payY = FOOTER_TOP - 34
    for (const line of paymentLines) {
      p.drawText(pdfText(line, supportsUnicode), {
        x: ML + 10,
        y: payY,
        size: 8,
        font: body,
        color: WARM_GREY,
      })
      payY -= 11
    }

    const thanks = 'Thank you for your business.'
    const thanksW = body.widthOfTextAtSize(thanks, 8)
    p.drawText(thanks, {
      x: (W - thanksW) / 2,
      y: 24,
      size: 8,
      font: body,
      color: WARM_GREY,
    })

    const pageLabel = `Page ${idx + 1}/${totalPages}`
    const pageW = body.widthOfTextAtSize(pageLabel, 8)
    p.drawText(pageLabel, {
      x: W - MR - pageW,
      y: 24,
      size: 8,
      font: body,
      color: WARM_GREY,
    })

    p.drawText(ISSUER.website, {
      x: ML,
      y: 24,
      size: 7.5,
      font: body,
      color: WARM_GREY,
    })
  })

  return doc.save()
}
