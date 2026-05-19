import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import type { Font, Fontkit } from 'pdf-lib/es/types/fontkit'
import nextFontkit from 'next/dist/compiled/@next/font/dist/fontkit'
import { prisma } from '@/lib/db/prisma'

const PRIMARY = rgb(0.365, 0.306, 0.216)
const ACCENT = rgb(0.824, 0.706, 0.549)
const PANEL = rgb(0.973, 0.976, 0.98)
const BLACK = rgb(0, 0, 0)
const GRAY = rgb(0.4, 0.4, 0.4)
const RED = rgb(0.8, 0.1, 0.1)
const ORANGE = rgb(0.9, 0.5, 0.0)
const GREEN = rgb(0.1, 0.6, 0.1)

interface PageState {
  page: PDFPage
  y: number
  bold: PDFFont
  regular: PDFFont
  width: number
  height: number
  margin: number
}

interface ReportFonts {
  bold: PDFFont
  regular: PDFFont
  supportsUnicode: boolean
  fontPath?: string
  fontError?: string
}

function loadFontkitBridge(): { fontkit: Fontkit; subset: boolean } | null {
  try {
    const fontFromBuffer = (nextFontkit as { default?: unknown }).default ?? nextFontkit

    if (typeof fontFromBuffer !== 'function') return null

    const fontkit: Fontkit = {
      create(data: Uint8Array) {
        const font = fontFromBuffer(Buffer.from(data))
        return (font.fonts?.[0] ?? font) as Font
      },
    }

    return { fontkit, subset: false }
  } catch {
    return null
  }
}

function riskColor(level: string | null) {
  if (level === 'HIGH') return RED
  if (level === 'MEDIUM') return ORANGE
  return GREEN
}

function normalizePdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function drawPageText(page: PDFPage, text: string, options: Parameters<PDFPage['drawText']>[1]) {
  page.drawText(normalizePdfText(text), options)
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const normalized = normalizePdfText(text)
  const words = /[\s-]/.test(normalized) ? normalized.split(/(\s+)/) : Array.from(normalized)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current}${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word.trimStart()
    }
  }
  if (current.trim()) lines.push(current)
  return lines
}

async function cjkFontCandidates(): Promise<string[]> {
  const candidates = [
    process.env.DDR_PDF_FONT_PATH,
    path.join(process.cwd(), 'assets/fonts/NotoSansCJK-Regular.otf'),
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
  ].filter(Boolean) as string[]
  return Array.from(new Set(candidates))
}

async function firstExistingFontPath(): Promise<string | null> {
  const candidates = await cjkFontCandidates()

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next common CJK font location.
    }
  }

  return null
}

async function loadReportFonts(doc: PDFDocument): Promise<ReportFonts> {
  const fontPath = await firstExistingFontPath()
  const bridge = fontPath ? loadFontkitBridge() : null

  if (fontPath && bridge) {
    try {
      doc.registerFontkit(bridge.fontkit)
      const fontBytes = await fs.readFile(fontPath)
      const regular = await doc.embedFont(fontBytes, { subset: bridge.subset })
      return { regular, bold: regular, supportsUnicode: true, fontPath }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const bold = await doc.embedFont(StandardFonts.HelveticaBold)
      const regular = await doc.embedFont(StandardFonts.Helvetica)
      return { regular, bold, supportsUnicode: false, fontPath, fontError: message }
    }
  }

  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  return {
    regular,
    bold,
    supportsUnicode: false,
    fontPath: fontPath ?? undefined,
    fontError: fontPath ? 'A CJK font was found, but no fontkit bridge was available.' : 'No CJK font path was found.',
  }
}

async function ensureSpace(ps: PageState, doc: PDFDocument, needed: number): Promise<void> {
  if (ps.y - needed < ps.margin) {
    const page = doc.addPage([ps.width, ps.height])
    ps.page = page
    ps.y = ps.height - ps.margin
  }
}

export async function generateDDR(companyId: string, ddrId?: string): Promise<Buffer> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      directors: { where: { status: 'ACTIVE' } },
      members: { where: { status: 'ACTIVE' } },
      significantControllers: { where: { cessationDate: null } },
    },
  })

  const ddr = ddrId
    ? await prisma.dueDiligenceReport.findUniqueOrThrow({
        where: { id: ddrId },
        include: { riskAssessments: { orderBy: { questionKey: 'asc' } } },
      })
    : null

  const doc = await PDFDocument.create()
  const reportFonts = await loadReportFonts(doc)

  if (!reportFonts.supportsUnicode) {
    const tried = (await cjkFontCandidates()).join(', ')
    throw new Error(
      'DDR generation requires a CJK font because the report template contains Chinese text. ' +
      'On Linux: apt-get install fonts-noto-cjk. ' +
      'Or place a .ttf/.otf/.ttc font at assets/fonts/NotoSansCJK-Regular.otf. ' +
      'Or set the DDR_PDF_FONT_PATH environment variable to the font path. ' +
      `Current DDR_PDF_FONT_PATH=${process.env.DDR_PDF_FONT_PATH || '(not set)'}. ` +
      `Detected font path=${reportFonts.fontPath || '(none)'}. ` +
      `Font load error=${reportFonts.fontError || '(none)'}. ` +
      `Tried paths=${tried}.`
    )
  }

  const boldFont = reportFonts.bold
  const regularFont = reportFonts.regular

  const WIDTH = 595.28  // A4
  const HEIGHT = 841.89
  const MARGIN = 50
  const CONTENT_WIDTH = WIDTH - MARGIN * 2

  const page = doc.addPage([WIDTH, HEIGHT])
  const ps: PageState = { page, y: HEIGHT - MARGIN, bold: boldFont, regular: regularFont, width: WIDTH, height: HEIGHT, margin: MARGIN }

  // ── Reference-style cover block ──────────────────────────────────
  ps.page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: rgb(1, 1, 1) })
  ps.page.drawRectangle({ x: 42.52, y: 328.03, width: 510.24, height: 457.17, color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 1.5 })
  ps.page.drawRectangle({ x: 72.52, y: 566.8, width: 450.24, height: 70.5, color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 0.75 })
  drawPageText(ps.page, '盡職審查報告', { x: 216, y: 694, size: 26, font: boldFont, color: PRIMARY })
  drawPageText(ps.page, 'Due Diligence Report', { x: 168, y: 661, size: 21.6, font: boldFont, color: PRIMARY })
  drawPageText(ps.page, '盡職審查報告', { x: 252, y: 607, size: 15, font: boldFont, color: PRIMARY })
  drawPageText(ps.page, 'Due Diligence Report', { x: 217, y: 586, size: 15, font: regularFont, color: PRIMARY })
  ps.page.drawLine({ start: { x: 72.52, y: 542 }, end: { x: 522.76, y: 542 }, thickness: 1.5, color: ACCENT })
  drawPageText(ps.page, company.nameEn, { x: 72.52, y: 512, size: 12, font: boldFont, color: BLACK })
  if (company.nameZh) {
    drawPageText(ps.page, company.nameZh, { x: 72.52, y: 492, size: 12, font: boldFont, color: BLACK })
  }
  drawPageText(ps.page, `Report date: ${new Date().toLocaleDateString('en-HK')}`, { x: 72.52, y: 460, size: 9, font: regularFont, color: GRAY })

  ps.page = doc.addPage([WIDTH, HEIGHT])
  ps.y = HEIGHT - MARGIN

  // ── Section helper ───────────────────────────────────────────────
  function sectionHeader(title: string) {
    ps.y -= 20
    drawPageText(ps.page, title, { x: MARGIN + 6, y: ps.y, size: 10.5, font: boldFont, color: PRIMARY })
    ps.page.drawLine({ start: { x: MARGIN, y: ps.y - 8 }, end: { x: MARGIN + CONTENT_WIDTH, y: ps.y - 8 }, thickness: 1.5, color: ACCENT })
    ps.y -= 16
  }

  function field(label: string, value: string) {
    ps.y -= 14
    drawPageText(ps.page, label + ':', { x: MARGIN + 4, y: ps.y, size: 9, font: boldFont, color: GRAY })
    const lines = wrapText(value || '—', regularFont, 9, CONTENT_WIDTH - 130)
    lines.forEach((line, idx) => {
      drawPageText(ps.page, line, { x: MARGIN + 130, y: ps.y - idx * 12, size: 9, font: regularFont, color: BLACK })
    })
    if (lines.length > 1) ps.y -= (lines.length - 1) * 12
  }

  // ── 1. Subject Information ────────────────────────────────────────
  sectionHeader('1. 客戶資料 Client Information')
  field('Company Name (EN)', company.nameEn)
  field('Company Name (ZH)', company.nameZh ?? '')
  field('Company Number', company.companyNumber ?? '')
  field('Date of Incorporation', company.dateOfIncorporation ? company.dateOfIncorporation.toISOString().split('T')[0] : '')
  field('Registered Address', company.registeredAddress ?? '')
  field('Business Nature', company.businessNature ?? '')
  field('Status', company.status)

  // ── 2. Directors ─────────────────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('1.1 董事 Directors')
  if (company.directors.length === 0) {
    ps.y -= 14
    drawPageText(ps.page, 'No active directors recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }
  for (const d of company.directors) {
    await ensureSpace(ps, doc, 30)
    field(`Director`, `${d.nameEn}${d.nameZh ? ` / ${d.nameZh}` : ''} — Appointed: ${d.dateOfAppointment.toISOString().split('T')[0]}`)
  }

  // ── 3. Members (Shareholders) ─────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('1.2 股東 Shareholders')
  if (company.members.length === 0) {
    ps.y -= 14
    drawPageText(ps.page, 'No active members recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }
  for (const m of company.members) {
    await ensureSpace(ps, doc, 30)
    field('Member', `${m.nameEn}${m.nameZh ? ` / ${m.nameZh}` : ''} — ${m.shareClass} shares`)
  }

  // ── 4. Significant Controllers ────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('1.3 重要控制人 Significant Controllers')
  if (company.significantControllers.length === 0) {
    ps.y -= 14
    drawPageText(ps.page, 'No significant controllers recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }
  for (const sc of company.significantControllers) {
    await ensureSpace(ps, doc, 30)
    field('Controller', `${sc.nameEn}${sc.nameZh ? ` / ${sc.nameZh}` : ''} — ${sc.natureOfControl ?? 'Nature not specified'}`)
  }

  // ── 5. Risk Assessment ────────────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('2. 風險評估項目詳情 Risk Assessment Items Details')
  if (ddr?.riskAssessments && ddr.riskAssessments.length > 0) {
    let lastCategory = ''
    for (const ra of ddr.riskAssessments) {
      if (ra.category !== lastCategory) {
        await ensureSpace(ps, doc, 20)
        ps.y -= 14
        drawPageText(ps.page, `Category: ${ra.category}`, { x: MARGIN + 4, y: ps.y, size: 9, font: boldFont, color: PRIMARY })
        lastCategory = ra.category
      }
      await ensureSpace(ps, doc, 20)
      field(ra.questionKey, `${ra.answer}${ra.notes ? ` — ${ra.notes}` : ''}`)
    }
  } else {
    ps.y -= 14
    drawPageText(ps.page, 'No risk assessment answers recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }

  // ── 6. Overall Risk Level & Recommendation ────────────────────────
  await ensureSpace(ps, doc, 80)
  sectionHeader('3. 結論 Conclusion')

  if (ddr) {
    ps.y -= 14
    const riskText = ddr.overallRiskLevel ?? 'NOT SET'
    ps.page.drawRectangle({ x: MARGIN + 4, y: ps.y - 6, width: CONTENT_WIDTH - 8, height: 20, color: PANEL })
    drawPageText(ps.page, 'Overall Risk Level:', { x: MARGIN + 10, y: ps.y, size: 10, font: boldFont, color: BLACK })
    drawPageText(ps.page, riskText, { x: MARGIN + 130, y: ps.y, size: 10, font: boldFont, color: riskColor(ddr.overallRiskLevel ?? null) })

    ps.y -= 14
    drawPageText(ps.page, 'Recommendation:', { x: MARGIN + 4, y: ps.y, size: 9, font: boldFont, color: GRAY })
    drawPageText(ps.page, ddr.recommendation ?? '-', { x: MARGIN + 130, y: ps.y, size: 9, font: regularFont, color: BLACK })

    if (ddr.recommendationNote) {
      field('Recommendation Note', ddr.recommendationNote)
    }
    if (ddr.approvalStatus !== null) {
      field('Approval Status', ddr.approvalStatus ? 'APPROVED' : 'NOT APPROVED')
    }
    if (ddr.approvalNote) {
      field('Approval Note', ddr.approvalNote)
    }
  } else {
    ps.y -= 14
    drawPageText(ps.page, 'Pending risk assessment completion.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }

  // ── 7. Disclaimer ─────────────────────────────────────────────────
  await ensureSpace(ps, doc, 80)
  sectionHeader('4. 免責聲明 Disclaimer')
  ps.y -= 14
  const disclaimer = 'This report is prepared by 6AM Advisory (Hong Kong) Limited for internal compliance purposes only. The information contained herein is confidential and subject to applicable data protection laws including the Hong Kong Personal Data (Privacy) Ordinance. This report shall not be disclosed to any third party without prior written consent.'
  const disclaimerLines = wrapText(disclaimer, regularFont, 8, CONTENT_WIDTH - 8)
  for (const line of disclaimerLines) {
    drawPageText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: regularFont, color: GRAY })
    ps.y -= 11
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
