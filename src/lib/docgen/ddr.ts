import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import { prisma } from '@/lib/db/prisma'

const PRIMARY = rgb(0.18, 0.32, 0.52)  // 6AM Advisory blue
const BLACK = rgb(0, 0, 0)
const GRAY = rgb(0.4, 0.4, 0.4)
const LIGHT_GRAY = rgb(0.92, 0.92, 0.92)
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

function riskColor(level: string | null) {
  if (level === 'HIGH') return RED
  if (level === 'MEDIUM') return ORANGE
  return GREEN
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawText(ps: PageState, text: string, x: number, fontSize: number, color = BLACK, bold = false) {
  const font = bold ? ps.bold : ps.regular
  ps.page.drawText(text, { x, y: ps.y, size: fontSize, font, color })
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
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)

  const WIDTH = 595.28  // A4
  const HEIGHT = 841.89
  const MARGIN = 50
  const CONTENT_WIDTH = WIDTH - MARGIN * 2

  let page = doc.addPage([WIDTH, HEIGHT])
  const ps: PageState = { page, y: HEIGHT - MARGIN, bold: boldFont, regular: regularFont, width: WIDTH, height: HEIGHT, margin: MARGIN }

  // ── Title block ──────────────────────────────────────────────────
  ps.page.drawRectangle({ x: 0, y: HEIGHT - 80, width: WIDTH, height: 80, color: PRIMARY })
  ps.page.drawText('6AM Advisory (Hong Kong) Limited', { x: MARGIN, y: HEIGHT - 30, size: 13, font: boldFont, color: rgb(1, 1, 1) })
  ps.page.drawText('Due Diligence Report', { x: MARGIN, y: HEIGHT - 50, size: 18, font: boldFont, color: rgb(1, 1, 1) })
  ps.page.drawText(`Generated: ${new Date().toLocaleDateString('en-HK')}`, { x: MARGIN, y: HEIGHT - 68, size: 9, font: regularFont, color: rgb(0.8, 0.8, 0.8) })
  ps.y = HEIGHT - 100

  // ── Section helper ───────────────────────────────────────────────
  function sectionHeader(title: string) {
    ps.y -= 20
    ps.page.drawRectangle({ x: MARGIN, y: ps.y - 4, width: CONTENT_WIDTH, height: 18, color: PRIMARY })
    ps.page.drawText(title, { x: MARGIN + 6, y: ps.y, size: 10, font: boldFont, color: rgb(1, 1, 1) })
    ps.y -= 16
  }

  function field(label: string, value: string) {
    ps.y -= 14
    ps.page.drawText(label + ':', { x: MARGIN + 4, y: ps.y, size: 9, font: boldFont, color: GRAY })
    const lines = wrapText(value || '—', regularFont, 9, CONTENT_WIDTH - 130)
    lines.forEach((line, idx) => {
      ps.page.drawText(line, { x: MARGIN + 130, y: ps.y - idx * 12, size: 9, font: regularFont, color: BLACK })
    })
    if (lines.length > 1) ps.y -= (lines.length - 1) * 12
  }

  // ── 1. Subject Information ────────────────────────────────────────
  sectionHeader('1. Subject Information')
  field('Company Name (EN)', company.nameEn)
  field('Company Name (ZH)', company.nameZh ?? '')
  field('Company Number', company.companyNumber ?? '')
  field('Date of Incorporation', company.dateOfIncorporation ? company.dateOfIncorporation.toISOString().split('T')[0] : '')
  field('Registered Address', company.registeredAddress ?? '')
  field('Business Nature', company.businessNature ?? '')
  field('Status', company.status)

  // ── 2. Directors ─────────────────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('2. Directors')
  if (company.directors.length === 0) {
    ps.y -= 14
    ps.page.drawText('No active directors recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }
  for (const d of company.directors) {
    await ensureSpace(ps, doc, 30)
    field(`Director`, `${d.nameEn}${d.nameZh ? ` / ${d.nameZh}` : ''} — Appointed: ${d.dateOfAppointment.toISOString().split('T')[0]}`)
  }

  // ── 3. Members (Shareholders) ─────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('3. Shareholders')
  if (company.members.length === 0) {
    ps.y -= 14
    ps.page.drawText('No active members recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }
  for (const m of company.members) {
    await ensureSpace(ps, doc, 30)
    field('Member', `${m.nameEn}${m.nameZh ? ` / ${m.nameZh}` : ''} — ${m.shareClass} shares`)
  }

  // ── 4. Significant Controllers ────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('4. Significant Controllers')
  if (company.significantControllers.length === 0) {
    ps.y -= 14
    ps.page.drawText('No significant controllers recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }
  for (const sc of company.significantControllers) {
    await ensureSpace(ps, doc, 30)
    field('Controller', `${sc.nameEn}${sc.nameZh ? ` / ${sc.nameZh}` : ''} — ${sc.natureOfControl ?? 'Nature not specified'}`)
  }

  // ── 5. Risk Assessment ────────────────────────────────────────────
  await ensureSpace(ps, doc, 60)
  sectionHeader('5. Risk Assessment')
  if (ddr?.riskAssessments && ddr.riskAssessments.length > 0) {
    let lastCategory = ''
    for (const ra of ddr.riskAssessments) {
      if (ra.category !== lastCategory) {
        await ensureSpace(ps, doc, 20)
        ps.y -= 14
        ps.page.drawText(`Category: ${ra.category}`, { x: MARGIN + 4, y: ps.y, size: 9, font: boldFont, color: PRIMARY })
        lastCategory = ra.category
      }
      await ensureSpace(ps, doc, 20)
      field(ra.questionKey, `${ra.answer}${ra.notes ? ` — ${ra.notes}` : ''}`)
    }
  } else {
    ps.y -= 14
    ps.page.drawText('No risk assessment answers recorded.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }

  // ── 6. Overall Risk Level & Recommendation ────────────────────────
  await ensureSpace(ps, doc, 80)
  sectionHeader('6. Overall Risk & Recommendation')

  if (ddr) {
    ps.y -= 14
    const riskText = ddr.overallRiskLevel ?? 'NOT SET'
    ps.page.drawText('Overall Risk Level:', { x: MARGIN + 4, y: ps.y, size: 10, font: boldFont, color: BLACK })
    ps.page.drawText(riskText, { x: MARGIN + 130, y: ps.y, size: 10, font: boldFont, color: riskColor(ddr.overallRiskLevel ?? null) })

    ps.y -= 14
    ps.page.drawText('Recommendation:', { x: MARGIN + 4, y: ps.y, size: 9, font: boldFont, color: GRAY })
    ps.page.drawText(ddr.recommendation ?? '—', { x: MARGIN + 130, y: ps.y, size: 9, font: regularFont, color: BLACK })

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
    ps.page.drawText('Pending risk assessment completion.', { x: MARGIN + 4, y: ps.y, size: 9, font: regularFont, color: GRAY })
  }

  // ── 7. Disclaimer ─────────────────────────────────────────────────
  await ensureSpace(ps, doc, 80)
  sectionHeader('7. Disclaimer')
  ps.y -= 14
  const disclaimer = 'This report is prepared by 6AM Advisory (Hong Kong) Limited for internal compliance purposes only. The information contained herein is confidential and subject to applicable data protection laws including the Hong Kong Personal Data (Privacy) Ordinance. This report shall not be disclosed to any third party without prior written consent.'
  const disclaimerLines = wrapText(disclaimer, regularFont, 8, CONTENT_WIDTH - 8)
  for (const line of disclaimerLines) {
    ps.page.drawText(line, { x: MARGIN + 4, y: ps.y, size: 8, font: regularFont, color: GRAY })
    ps.y -= 11
  }

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
