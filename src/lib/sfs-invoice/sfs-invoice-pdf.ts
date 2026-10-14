import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import type { SfsInvoice, SfsInvoiceLineItem, SfsOrder } from '@prisma/client'
import {
  SFS_INVOICE_ISSUER as ISSUER,
  SFS_INVOICE_PAYMENT as PAYMENT_INFO,
  sfsFmtAmount as fmtAmount,
  sfsFmtDate as fmtDate,
  sfsFmtMoney as fmtMoney,
  sfsFmtQty as fmtQty,
  sfsInvoiceBaseFilename,
} from '@/lib/sfs-invoice/sfs-invoice-brand'
import { loadSfsInvoiceFonts } from '@/lib/sfs-invoice/sfs-invoice-fonts'

export type SfsInvoicePdfPayload = SfsInvoice & {
  lineItems: SfsInvoiceLineItem[]
  order: Pick<SfsOrder, 'memorialName' | 'sampleCode' | 'clientName'> | null
}

/** Blue Luxury palette — matches SFS_Invoice_*_Logo_Blue_Luxury.docx */
const PAPER = rgb(1, 1, 1)
const NAVY = rgb(0.008, 0.086, 0.275) // #021647
const GOLD = rgb(0.702, 0.573, 0.404) // #B39267
const RULE_SOFT = rgb(0.82, 0.82, 0.84)
const TOTAL_WASH = rgb(0.937, 0.859, 0.757) // #EFDAC1
const WHITE = rgb(1, 1, 1)

function pdfText(s: string | null | undefined, supportsUnicode: boolean): string {
  if (!s) return '-'
  const normalized = s
    .replace(/[—–]/g, '-')
    .replace(/·/g, '.')
  if (supportsUnicode) return normalized
  return normalized.replace(/[^\x00-\xFF]/g, '?')
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

async function loadBrandLockup(doc: PDFDocument): Promise<PDFImage | null> {
  const full = path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/sfs-invoice/sfs-brand-lockup.png')
  try {
    await fs.access(full)
  } catch {
    return null
  }
  const bytes = await fs.readFile(full)
  return doc.embedPng(bytes)
}

export function sfsInvoicePdfFilename(invoice: Pick<SfsInvoice, 'invoiceNumber'>): string {
  return `${sfsInvoiceBaseFilename(pdfText(invoice.invoiceNumber, false))}.pdf`
}

export async function renderSfsInvoicePdf(invoice: SfsInvoicePdfPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts = await loadSfsInvoiceFonts(doc)
  const { display, section, body, amount, cjk, supportsUnicode } = fonts
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const brandLockup = await loadBrandLockup(doc)

  const W = 595
  const H = 842
  const ML = 48
  const MR = 48
  const CW = W - ML - MR
  const FOOTER_TOP = 138
  const CONTENT_BOTTOM_Y = FOOTER_TOP + 16
  const BODY_SIZE = 9.5
  const BODY_LEADING = BODY_SIZE * 1.35

  // Column geometry (description + qty + unit + amount)
  const colQtyW = 48
  const colUnitW = 78
  const colAmtW = 78
  const colDescW = CW - colQtyW - colUnitW - colAmtW
  const xDesc = ML
  const xQty = ML + colDescW
  const xUnit = xQty + colQtyW
  const xAmt = xUnit + colUnitW

  let page = doc.addPage([W, H])
  let y = H - 52

  function paintPaper(target: PDFPage) {
    target.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })
  }

  function preparePage(target: PDFPage) {
    paintPaper(target)
  }

  function ensureSpace(needed: number) {
    if (y - needed < CONTENT_BOTTOM_Y) {
      page = doc.addPage([W, H])
      preparePage(page)
      y = H - 52
      drawTableHeader()
    }
  }

  function drawGoldRule(atY: number, fromX = ML, toX = W - MR, thickness = 0.6) {
    page.drawLine({
      start: { x: fromX, y: atY },
      end: { x: toX, y: atY },
      thickness,
      color: GOLD,
    })
  }

  function drawVRule(x: number, top: number, bottom: number, color = GOLD, thickness = 0.5) {
    page.drawLine({
      start: { x, y: top },
      end: { x, y: bottom },
      thickness,
      color,
    })
  }

  function drawRight(
    text: string,
    rightEdge: number,
    atY: number,
    size: number,
    font: PDFFont,
    color = NAVY,
  ) {
    const t = pdfText(text, supportsUnicode)
    const width = font.widthOfTextAtSize(t, size)
    page.drawText(t, { x: rightEdge - width, y: atY, size, font, color })
  }

  function drawTableHeader() {
    const hdrH = 22
    const hdrY = y - hdrH
    page.drawRectangle({ x: ML, y: hdrY, width: CW, height: hdrH, color: NAVY })
    const labelY = hdrY + 7
    const hdrSize = 8
    page.drawText('DESCRIPTION', { x: xDesc + 8, y: labelY, size: hdrSize, font: sansBold, color: WHITE })
    drawRight('QTY', xUnit - 8, labelY, hdrSize, sansBold, WHITE)
    drawRight('UNIT', xAmt - 8, labelY, hdrSize, sansBold, WHITE)
    drawRight('AMOUNT', W - MR - 8, labelY, hdrSize, sansBold, WHITE)
    // white column dividers in header
    for (const vx of [xQty, xUnit, xAmt]) {
      page.drawLine({
        start: { x: vx, y: hdrY + 3 },
        end: { x: vx, y: hdrY + hdrH - 3 },
        thickness: 0.5,
        color: WHITE,
        opacity: 0.55,
      })
    }
    y = hdrY - 2
  }

  preparePage(page)

  // ── Header: INVOICE + brand ──────────────────────────────────────────────
  const headerTop = y
  const title = 'INVOICE'
  const titleSize = 34
  const titleTracking = 0.12
  const titleW = drawTracked(page, title, ML, headerTop - 4, titleSize, display, NAVY, titleTracking)

  // Brand block (top-right): S.F.S. Memorial Diamonds lockup
  const brandRight = W - MR
  const brandImgW = 140
  const brandImgH = 52
  let brandBottom = headerTop - 8
  if (brandLockup) {
    const brandX = brandRight - brandImgW
    const brandY = headerTop - brandImgH + 8
    page.drawImage(brandLockup, {
      x: brandX,
      y: brandY,
      width: brandImgW,
      height: brandImgH,
    })
    brandBottom = brandY
  } else {
    const wordmark = 'S.F.S.'
    const wordSize = 22
    const wordW = sansBold.widthOfTextAtSize(wordmark, wordSize)
    const tagline = 'MEMORIAL DIAMONDS'
    const tagSize = 7
    const tagTrack = 0.22
    const tagW = trackedWidth(tagline, tagSize, sans, tagTrack)
    const textBlockW = Math.max(wordW, tagW)
    const textX = brandRight - textBlockW
    const wordY = headerTop - 8
    page.drawText(wordmark, { x: textX, y: wordY, size: wordSize, font: sansBold, color: NAVY })
    const ruleY = wordY - 6
    page.drawLine({
      start: { x: textX, y: ruleY },
      end: { x: textX + textBlockW, y: ruleY },
      thickness: 0.6,
      color: GOLD,
    })
    drawTracked(page, tagline, textX, ruleY - 12, tagSize, sans, NAVY, tagTrack)
    brandBottom = ruleY - 14
  }

  // Gold rule under INVOICE (extends to just past title, not full width)
  const invoiceRuleY = headerTop - 18
  page.drawLine({
    start: { x: ML, y: invoiceRuleY },
    end: { x: ML + titleW + 8, y: invoiceRuleY },
    thickness: 0.7,
    color: GOLD,
  })

  // Meta row: Invoice No. | Issue date | Status
  y = Math.min(invoiceRuleY, brandBottom) - 22
  const metaTop = y + 12
  const metaBottom = y - 6
  const metaCols = [
    { label: 'Invoice No.:', value: invoice.invoiceNumber, goldValue: false },
    { label: 'Issue date:', value: fmtDate(invoice.issueDate), goldValue: false },
    { label: 'Status:', value: invoice.status, goldValue: invoice.status === 'DRAFT' },
  ]
  const metaColW = CW / 3
  metaCols.forEach((col, i) => {
    const cx = ML + i * metaColW
    if (i > 0) drawVRule(cx, metaTop, metaBottom, RULE_SOFT, 0.45)
    page.drawText(col.label, {
      x: cx + 10,
      y: y + 2,
      size: 8,
      font: section,
      color: NAVY,
    })
    const labelW = section.widthOfTextAtSize(col.label, 8)
    page.drawText(pdfText(col.value, supportsUnicode), {
      x: cx + 10 + labelW + 6,
      y: y + 2,
      size: 11,
      font: amount,
      color: col.goldValue ? GOLD : NAVY,
    })
  })

  y -= 16
  drawGoldRule(y)
  y -= 18

  // ── Issuer | BILL TO ─────────────────────────────────────────────────────
  const midX = ML + CW * 0.5
  const leftMaxW = midX - ML - 14
  const rightX = midX + 14
  const rightMaxW = W - MR - rightX

  const issuerStartY = y
  page.drawText(pdfText(ISSUER.nameEn, supportsUnicode), {
    x: ML,
    y,
    size: 11,
    font: amount,
    color: NAVY,
  })
  y -= 14
  page.drawText(pdfText(ISSUER.nameZh, supportsUnicode), {
    x: ML,
    y,
    size: 9,
    font: cjk,
    color: NAVY,
  })
  y -= 13
  for (const line of wrapLines(ISSUER.address, body, 8, leftMaxW)) {
    page.drawText(pdfText(line, supportsUnicode), {
      x: ML,
      y,
      size: 8,
      font: body,
      color: NAVY,
    })
    y -= 11
  }
  page.drawText(pdfText(ISSUER.email, supportsUnicode), {
    x: ML,
    y,
    size: 8,
    font: body,
    color: NAVY,
  })
  const issuerBottom = y
  y = issuerStartY

  // BILL TO column
  page.drawText('BILL TO', {
    x: rightX,
    y,
    size: 8,
    font: sansBold,
    color: GOLD,
  })
  y -= 14
  page.drawText(pdfText(invoice.billToName, supportsUnicode), {
    x: rightX,
    y,
    size: 12,
    font: amount,
    color: NAVY,
  })
  y -= BODY_LEADING + 1

  const billLines = [
    invoice.billToPhone,
    ...(invoice.billToAddress
      ? wrapLines(pdfText(invoice.billToAddress, supportsUnicode), body, BODY_SIZE, rightMaxW)
      : []),
    invoice.billToEmail,
  ].filter((v): v is string => Boolean(v && String(v).trim()))

  for (const line of billLines) {
    page.drawText(pdfText(line, supportsUnicode), {
      x: rightX,
      y,
      size: BODY_SIZE,
      font: body,
      color: NAVY,
    })
    y -= BODY_LEADING
  }

  const partiesBottom = Math.min(issuerBottom, y)
  drawVRule(midX, issuerStartY + 10, partiesBottom - 2, GOLD, 0.55)

  y = partiesBottom - 14
  drawGoldRule(y)
  y -= 16

  // ── Sample / Memorial ────────────────────────────────────────────────────
  if (invoice.order?.sampleCode || invoice.order?.memorialName) {
    ensureSpace(28)
    const parts: string[] = []
    if (invoice.order.sampleCode) parts.push(`Sample ID: ${invoice.order.sampleCode}`)
    if (invoice.order.memorialName) parts.push(`Memorial: ${invoice.order.memorialName}`)
    const sampleText = parts.join('  |  ')
    page.drawText(pdfText(sampleText, supportsUnicode), {
      x: ML,
      y,
      size: 10,
      font: amount,
      color: NAVY,
    })
    y -= 14
    drawGoldRule(y)
    y -= 14
  }

  // ── Line items table ─────────────────────────────────────────────────────
  ensureSpace(40)
  drawTableHeader()

  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
  sorted.forEach((line) => {
    const desc = pdfText(line.description, supportsUnicode)
    const descLines = wrapLines(desc, body, BODY_SIZE, colDescW - 16)
    const pad = 6
    const rowH = Math.max(22, descLines.length * BODY_LEADING + pad * 2)
    ensureSpace(rowH + 2)

    const rowBottom = y - rowH
    // gold grid
    page.drawLine({
      start: { x: ML, y: rowBottom },
      end: { x: W - MR, y: rowBottom },
      thickness: 0.4,
      color: GOLD,
    })
    for (const vx of [xQty, xUnit, xAmt]) {
      drawVRule(vx, y, rowBottom, GOLD, 0.4)
    }
    drawVRule(ML, y, rowBottom, GOLD, 0.4)
    drawVRule(W - MR, y, rowBottom, GOLD, 0.4)

    let textY = y - pad - BODY_SIZE + 2
    for (const part of descLines) {
      page.drawText(part, {
        x: xDesc + 8,
        y: textY,
        size: BODY_SIZE,
        font: body,
        color: NAVY,
      })
      textY -= BODY_LEADING
    }

    const numY = y - pad - BODY_SIZE + 2
    drawRight(fmtQty(line.quantity), xUnit - 8, numY, BODY_SIZE, amount, NAVY)
    drawRight(fmtAmount(line.unitPrice), xAmt - 8, numY, BODY_SIZE, amount, NAVY)
    drawRight(fmtAmount(line.amount), W - MR - 8, numY, BODY_SIZE, amount, NAVY)

    y = rowBottom
  })

  // ── Subtotal + TOTAL ─────────────────────────────────────────────────────
  y -= 10
  ensureSpace(48)
  const totalsRight = W - MR
  const totalsLabelX = xUnit

  page.drawText('Subtotal', {
    x: totalsLabelX + 6,
    y,
    size: 10,
    font: body,
    color: NAVY,
  })
  drawRight(fmtMoney(invoice.subtotal, invoice.currency), totalsRight, y, 10, amount, NAVY)
  y -= 10
  drawGoldRule(y, totalsLabelX - 4, totalsRight)
  y -= 4

  const totalBarH = 22
  const totalBarY = y - totalBarH
  page.drawRectangle({
    x: totalsLabelX - 4,
    y: totalBarY,
    width: totalsRight - (totalsLabelX - 4),
    height: totalBarH,
    color: TOTAL_WASH,
  })
  page.drawText('TOTAL', {
    x: totalsLabelX + 6,
    y: totalBarY + 7,
    size: 11,
    font: amount,
    color: NAVY,
  })
  drawRight(fmtMoney(invoice.total, invoice.currency), totalsRight - 6, totalBarY + 7, 12, amount, NAVY)
  y = totalBarY - 14

  if (invoice.notes?.trim()) {
    ensureSpace(40)
    page.drawText('NOTES', { x: ML, y, size: 8, font: sansBold, color: GOLD })
    y -= 12
    for (const part of wrapLines(pdfText(invoice.notes, supportsUnicode), body, BODY_SIZE, CW)) {
      ensureSpace(BODY_LEADING)
      page.drawText(part, { x: ML, y, size: BODY_SIZE, font: body, color: NAVY })
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
      thickness: 0.6,
      color: GOLD,
    })

    p.drawText('PAYMENT INFORMATION', {
      x: ML,
      y: FOOTER_TOP - 16,
      size: 8,
      font: sansBold,
      color: GOLD,
    })

    const paymentLines = [
      PAYMENT_INFO.bank,
      `${PAYMENT_INFO.swift}  ·  ${PAYMENT_INFO.bankCode}`,
      PAYMENT_INFO.accountNumber,
      PAYMENT_INFO.accountName,
    ]
    let payY = FOOTER_TOP - 32
    paymentLines.forEach((line, i) => {
      p.drawText(pdfText(line, supportsUnicode), {
        x: ML,
        y: payY,
        size: 8,
        font: i === 0 ? amount : body,
        color: NAVY,
      })
      payY -= 11
    })

    p.drawLine({
      start: { x: ML, y: 36 },
      end: { x: W - MR, y: 36 },
      thickness: 0.6,
      color: GOLD,
    })

    p.drawText(ISSUER.website, {
      x: ML,
      y: 22,
      size: 8,
      font: body,
      color: NAVY,
    })

    const thanks = 'Thank you for your business.'
    const thanksW = section.widthOfTextAtSize(thanks, 9)
    p.drawText(thanks, {
      x: (W - thanksW) / 2,
      y: 22,
      size: 9,
      font: section,
      color: GOLD,
    })

    const pageLabel = `Page ${idx + 1}/${totalPages}`
    const pageW = body.widthOfTextAtSize(pageLabel, 8)
    p.drawText(pageLabel, {
      x: W - MR - pageW,
      y: 22,
      size: 8,
      font: body,
      color: NAVY,
    })
  })

  return doc.save()
}
