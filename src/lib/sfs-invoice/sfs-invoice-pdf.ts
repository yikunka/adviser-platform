/**
 * SFS invoice PDF — same Blue Luxury layout as renderSfsInvoiceDocx (Word).
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import type { SfsInvoice, SfsInvoiceLineItem, SfsOrder } from '@prisma/client'
import {
  SFS_INVOICE_ISSUER as ISSUER,
  SFS_INVOICE_PAYMENT as PAYMENT,
  sfsFmtAmount,
  sfsFmtDate,
  sfsFmtMoney,
  sfsFmtQty,
  sfsInvoiceBaseFilename,
} from '@/lib/sfs-invoice/sfs-invoice-brand'
import { loadSfsInvoiceFonts } from '@/lib/sfs-invoice/sfs-invoice-fonts'

export type SfsInvoicePdfPayload = SfsInvoice & {
  lineItems: SfsInvoiceLineItem[]
  order: Pick<SfsOrder, 'memorialName' | 'sampleCode' | 'clientName'> | null
}

const PAPER = rgb(1, 1, 1)
const NAVY = rgb(0.008, 0.086, 0.275) // #021647
const GOLD = rgb(0.702, 0.573, 0.404) // #B39267
const RULE_SOFT = rgb(0.816, 0.816, 0.831) // #D0D0D4
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
  return `SFS_Invoice_${sfsInvoiceBaseFilename(pdfText(invoice.invoiceNumber, false))}.pdf`
}

export async function renderSfsInvoicePdf(invoice: SfsInvoicePdfPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts = await loadSfsInvoiceFonts(doc)
  const { display, section, body, amount, cjk, supportsUnicode } = fonts
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const brandLockup = await loadBrandLockup(doc)

  // Match Word: A4 + 0.5" margins
  const W = 595.28
  const H = 841.89
  const M = 36
  const CW = W - M * 2

  // Same column ratios as Word (5600 / 1200 / 1800 / 1866 of 10466)
  const colDescW = CW * (5600 / 10466)
  const colQtyW = CW * (1200 / 10466)
  const colUnitW = CW * (1800 / 10466)
  const colAmtW = CW - colDescW - colQtyW - colUnitW
  const xDesc = M
  const xQty = M + colDescW
  const xUnit = xQty + colQtyW
  const xAmt = xUnit + colUnitW

  // Footer strip (website | thank you | page) — payment lives in body like Word
  const FOOTER_H = 40
  const CONTENT_BOTTOM = FOOTER_H + 16

  let page = doc.addPage([W, H])
  let y = H - M

  function paintPaper(target: PDFPage) {
    target.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER })
  }

  function preparePage(target: PDFPage) {
    paintPaper(target)
  }

  function drawGoldRule(atY: number, fromX = M, toX = W - M, thickness = 0.75) {
    page.drawLine({
      start: { x: fromX, y: atY },
      end: { x: toX, y: atY },
      thickness,
      color: GOLD,
    })
  }

  function drawVRule(x: number, top: number, bottom: number, color = GOLD, thickness = 0.6) {
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
    page.drawText(t, { x: rightEdge - font.widthOfTextAtSize(t, size), y: atY, size, font, color })
  }

  function drawTableHeader() {
    const hdrH = 22
    const hdrY = y - hdrH
    page.drawRectangle({ x: M, y: hdrY, width: CW, height: hdrH, color: NAVY })
    // gold outer border around header
    page.drawRectangle({
      x: M,
      y: hdrY,
      width: CW,
      height: hdrH,
      borderColor: GOLD,
      borderWidth: 0.6,
    })
    const labelY = hdrY + 7
    const hdrSize = 8
    page.drawText('DESCRIPTION', { x: xDesc + 8, y: labelY, size: hdrSize, font: sansBold, color: WHITE })
    drawRight('QTY', xUnit - 8, labelY, hdrSize, sansBold, WHITE)
    drawRight('UNIT', xAmt - 8, labelY, hdrSize, sansBold, WHITE)
    drawRight('AMOUNT', W - M - 8, labelY, hdrSize, sansBold, WHITE)
    for (const vx of [xQty, xUnit, xAmt]) {
      page.drawLine({
        start: { x: vx, y: hdrY },
        end: { x: vx, y: hdrY + hdrH },
        thickness: 0.6,
        color: GOLD,
      })
    }
    y = hdrY
  }

  function ensureSpace(needed: number) {
    if (y - needed < CONTENT_BOTTOM) {
      page = doc.addPage([W, H])
      preparePage(page)
      y = H - M
      drawTableHeader()
    }
  }

  preparePage(page)

  // ── Header: INVOICE | brand lockup (same as Word) ───────────────────────
  const headerTop = y - 4
  const titleSize = 28
  const titleTracking = 0.12
  const titleW = drawTracked(page, 'INVOICE', M, headerTop - titleSize + 10, titleSize, display, NAVY, titleTracking)

  // Word ImageRun 168×63 px ≈ 126×47 pt at 96dpi
  const brandImgW = 126
  const brandImgH = 47
  let brandBottom = headerTop - 8
  if (brandLockup) {
    const brandX = W - M - brandImgW
    const brandY = headerTop - brandImgH + 6
    page.drawImage(brandLockup, { x: brandX, y: brandY, width: brandImgW, height: brandImgH })
    brandBottom = brandY
  } else {
    const wordmark = 'S.F.S.'
    const wordSize = 20
    const wordW = sansBold.widthOfTextAtSize(wordmark, wordSize)
    const tagline = 'MEMORIAL DIAMONDS'
    const tagSize = 7
    const tagTrack = 0.22
    const textBlockW = Math.max(wordW, trackedWidth(tagline, tagSize, sans, tagTrack))
    const textX = W - M - textBlockW
    const wordY = headerTop - 6
    page.drawText(wordmark, { x: textX, y: wordY, size: wordSize, font: sansBold, color: NAVY })
    const ruleY = wordY - 6
    page.drawLine({
      start: { x: textX, y: ruleY },
      end: { x: textX + textBlockW, y: ruleY },
      thickness: 0.6,
      color: GOLD,
    })
    drawTracked(page, tagline, textX, ruleY - 11, tagSize, sans, NAVY, tagTrack)
    brandBottom = ruleY - 14
  }

  // Gold underline under INVOICE only (matches Word paragraph border)
  const invoiceRuleY = headerTop - titleSize + 2
  page.drawLine({
    start: { x: M, y: invoiceRuleY },
    end: { x: M + titleW + 4, y: invoiceRuleY },
    thickness: 0.75,
    color: GOLD,
  })

  // ── Meta row ────────────────────────────────────────────────────────────
  y = Math.min(invoiceRuleY, brandBottom) - 18
  const metaTop = y + 10
  const metaBottom = y - 4
  const metaCols = [
    { label: 'Invoice No.:', value: invoice.invoiceNumber, goldValue: false },
    { label: 'Issue date:', value: sfsFmtDate(invoice.issueDate), goldValue: false },
    { label: 'Status:', value: invoice.status, goldValue: invoice.status === 'DRAFT' },
  ]
  const metaColW = CW / 3
  metaCols.forEach((col, i) => {
    const cx = M + i * metaColW
    if (i > 0) drawVRule(cx, metaTop, metaBottom, RULE_SOFT, 0.5)
    const label = col.label + ' '
    page.drawText(label, { x: cx + 8, y: y, size: 8, font: section, color: NAVY })
    const labelW = section.widthOfTextAtSize(label, 8)
    page.drawText(pdfText(col.value, supportsUnicode), {
      x: cx + 8 + labelW,
      y,
      size: 11,
      font: amount,
      color: col.goldValue ? GOLD : NAVY,
    })
  })

  y -= 14
  drawGoldRule(y)
  y -= 14

  // ── Issuer | BILL TO ────────────────────────────────────────────────────
  const midX = M + CW / 2
  const leftMaxW = midX - M - 12
  const rightX = midX + 12
  const rightMaxW = W - M - rightX
  const issuerStartY = y

  page.drawText(pdfText(ISSUER.nameEn, supportsUnicode), {
    x: M, y, size: 11, font: amount, color: NAVY,
  })
  y -= 13
  page.drawText(pdfText(ISSUER.nameZh, supportsUnicode), {
    x: M, y, size: 9, font: cjk, color: NAVY,
  })
  y -= 12
  for (const line of wrapLines(ISSUER.address, body, 8, leftMaxW)) {
    page.drawText(pdfText(line, supportsUnicode), {
      x: M, y, size: 8, font: body, color: NAVY,
    })
    y -= 10
  }
  page.drawText(pdfText(ISSUER.email, supportsUnicode), {
    x: M, y, size: 8, font: body, color: NAVY,
  })
  const issuerBottom = y

  y = issuerStartY
  page.drawText('BILL TO', { x: rightX, y, size: 8, font: sansBold, color: GOLD })
  y -= 13
  page.drawText(pdfText(invoice.billToName, supportsUnicode), {
    x: rightX, y, size: 12, font: amount, color: NAVY,
  })
  y -= 13

  const billLines = [
    invoice.billToPhone?.trim(),
    ...(invoice.billToAddress?.trim()
      ? wrapLines(pdfText(invoice.billToAddress, supportsUnicode), body, 9, rightMaxW)
      : []),
    invoice.billToEmail?.trim(),
  ].filter((v): v is string => Boolean(v))

  for (const line of billLines) {
    page.drawText(pdfText(line, supportsUnicode), {
      x: rightX, y, size: 9, font: body, color: NAVY,
    })
    y -= 11
  }

  const partiesBottom = Math.min(issuerBottom, y)
  drawVRule(midX, issuerStartY + 8, partiesBottom - 2, GOLD, 0.6)

  y = partiesBottom - 12
  drawGoldRule(y)
  y -= 12

  // ── Sample / Memorial ───────────────────────────────────────────────────
  if (invoice.order?.sampleCode || invoice.order?.memorialName) {
    ensureSpace(28)
    const parts: string[] = []
    if (invoice.order.sampleCode) parts.push(`Sample ID: ${invoice.order.sampleCode}`)
    if (invoice.order.memorialName) parts.push(`Memorial: ${invoice.order.memorialName}`)
    page.drawText(pdfText(parts.join('   |   '), supportsUnicode), {
      x: M, y, size: 10, font: amount, color: NAVY,
    })
    y -= 12
    drawGoldRule(y)
    y -= 12
  }

  // ── Line items table ────────────────────────────────────────────────────
  ensureSpace(40)
  drawTableHeader()

  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)
  const bodySize = 9
  const bodyLeading = 12

  for (const line of sorted) {
    const desc = pdfText(line.description, supportsUnicode)
    const descLines = wrapLines(desc, body, bodySize, colDescW - 16)
    const pad = 6
    const rowH = Math.max(22, descLines.length * bodyLeading + pad * 2)
    ensureSpace(rowH + 2)

    const rowTop = y
    const rowBottom = y - rowH

    // gold cell grid (same as Word GOLD_GRID)
    page.drawRectangle({
      x: M,
      y: rowBottom,
      width: CW,
      height: rowH,
      borderColor: GOLD,
      borderWidth: 0.55,
    })
    for (const vx of [xQty, xUnit, xAmt]) {
      drawVRule(vx, rowTop, rowBottom, GOLD, 0.55)
    }

    let textY = rowTop - pad - bodySize + 1
    for (const part of descLines) {
      page.drawText(part, { x: xDesc + 8, y: textY, size: bodySize, font: body, color: NAVY })
      textY -= bodyLeading
    }

    const numY = rowTop - pad - bodySize + 1
    drawRight(sfsFmtQty(line.quantity), xUnit - 8, numY, bodySize, amount, NAVY)
    drawRight(sfsFmtAmount(line.unitPrice), xAmt - 8, numY, bodySize, amount, NAVY)
    drawRight(sfsFmtAmount(line.amount), W - M - 8, numY, bodySize, amount, NAVY)

    y = rowBottom
  }

  // ── Subtotal + TOTAL (same geometry as Word totals table) ───────────────
  y -= 10
  ensureSpace(52)
  const totalsLabelW = CW * (2200 / 10466)
  const totalsValueW = CW * (2400 / 10466)
  const totalsPad = CW - totalsLabelW - totalsValueW
  const totalsLabelX = M + totalsPad
  const totalsRight = W - M

  page.drawText('Subtotal', {
    x: totalsLabelX + 6,
    y,
    size: 10,
    font: body,
    color: NAVY,
  })
  drawRight(sfsFmtMoney(invoice.subtotal, invoice.currency), totalsRight, y, 10, amount, NAVY)
  y -= 8
  drawGoldRule(y, totalsLabelX, totalsRight)
  y -= 2

  const totalBarH = 22
  const totalBarY = y - totalBarH
  page.drawRectangle({
    x: totalsLabelX,
    y: totalBarY,
    width: totalsLabelW + totalsValueW,
    height: totalBarH,
    color: TOTAL_WASH,
  })
  page.drawText('TOTAL', {
    x: totalsLabelX + 8,
    y: totalBarY + 7,
    size: 11,
    font: amount,
    color: NAVY,
  })
  drawRight(sfsFmtMoney(invoice.total, invoice.currency), totalsRight - 4, totalBarY + 7, 12, amount, NAVY)
  y = totalBarY - 14

  // ── Notes (body, before payment — same as Word) ─────────────────────────
  if (invoice.notes?.trim()) {
    ensureSpace(40)
    page.drawText('NOTES', { x: M, y, size: 8, font: sansBold, color: GOLD })
    y -= 12
    for (const part of wrapLines(pdfText(invoice.notes, supportsUnicode), body, 9, CW)) {
      ensureSpace(12)
      page.drawText(part, { x: M, y, size: 9, font: body, color: NAVY })
      y -= 12
    }
    y -= 4
  }

  // ── Payment information (body block — same as Word, not fixed footer) ───
  const paymentNeeded = 78
  if (y - paymentNeeded < CONTENT_BOTTOM) {
    page = doc.addPage([W, H])
    preparePage(page)
    y = H - M
  }

  drawGoldRule(y)
  y -= 14
  page.drawText('PAYMENT INFORMATION', {
    x: M, y, size: 8, font: sansBold, color: GOLD,
  })
  y -= 14
  page.drawText(pdfText(PAYMENT.bank, supportsUnicode), {
    x: M, y, size: 9, font: amount, color: NAVY,
  })
  y -= 11
  page.drawText(pdfText(`${PAYMENT.swift}  ·  ${PAYMENT.bankCode}`, supportsUnicode), {
    x: M, y, size: 8, font: body, color: NAVY,
  })
  y -= 11
  page.drawText(pdfText(PAYMENT.accountNumber, supportsUnicode), {
    x: M, y, size: 8, font: body, color: NAVY,
  })
  y -= 11
  page.drawText(pdfText(PAYMENT.accountName, supportsUnicode), {
    x: M, y, size: 8, font: body, color: NAVY,
  })

  // ── Footer on every page (website | thank you | page) ───────────────────
  const pages = doc.getPages()
  const totalPages = pages.length
  pages.forEach((p, idx) => {
    const footY = 22
    p.drawLine({
      start: { x: M, y: FOOTER_H },
      end: { x: W - M, y: FOOTER_H },
      thickness: 0.75,
      color: GOLD,
    })

    p.drawText(ISSUER.website, {
      x: M, y: footY, size: 8, font: body, color: NAVY,
    })

    const thanks = 'Thank you for your business.'
    const thanksW = section.widthOfTextAtSize(thanks, 9)
    p.drawText(thanks, {
      x: (W - thanksW) / 2,
      y: footY,
      size: 9,
      font: section,
      color: GOLD,
    })

    const pageLabel = `Page ${idx + 1}/${totalPages}`
    const pageW = body.widthOfTextAtSize(pageLabel, 8)
    p.drawText(pageLabel, {
      x: W - M - pageW,
      y: footY,
      size: 8,
      font: body,
      color: NAVY,
    })
  })

  return doc.save()
}
