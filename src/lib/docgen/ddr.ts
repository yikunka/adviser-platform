import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib'
import { prisma } from '@/lib/db/prisma'
import { screenSubjectNames } from '@/lib/aml/screener'
import {
  collectCompanyDdrScreeningSubjects,
  type OwnershipNode,
} from '@/lib/aml/ownershipLookThrough'
import {
  isAdverseMediaConfigured,
  listAdverseMediaForSubjects,
  runAdverseMediaScreen,
  type AdverseMediaFindingView,
} from '@/lib/aml/adverseMedia'
import { loadPdfFonts } from '@/lib/pdf/cjk-font'

// ── Colour palette ────────────────────────────────────────────────────────────
const PRIMARY    = rgb(0.365, 0.306, 0.216)  // warm brown
const ACCENT     = rgb(0.824, 0.706, 0.549)  // gold rule / border
const BLACK      = rgb(0, 0, 0)
const GRAY       = rgb(0.4,  0.4,  0.4)
const RED        = rgb(0.8,  0.1,  0.1)
const ORANGE     = rgb(0.9,  0.5,  0.0)
const GREEN_TEXT = rgb(0.08, 0.55, 0.08)
const GREEN_BG   = rgb(0.91, 0.97, 0.91)
const RED_BG     = rgb(0.98, 0.92, 0.92)
const TH_BG      = rgb(0.937, 0.914, 0.882) // table header – warm tan
const BORDER_C   = rgb(0.78,  0.73,  0.65)  // table border

// ── Page geometry (A4) ────────────────────────────────────────────────────────
const W       = 595.28
const H       = 841.89
const MARGIN  = 50
const CW      = W - MARGIN * 2          // content width
const ROW_H   = 22                      // standard table row height
const BORDER_W = 0.5

// ── Page state ────────────────────────────────────────────────────────────────
interface PageState {
  page: PDFPage
  y: number
  bold: PDFFont
  regular: PDFFont
}

interface ReportFonts {
  bold: PDFFont
  regular: PDFFont
  supportsUnicode: boolean
}

type ReportPerson = {
  id?: string
  nameEn: string
  nameZh: string | null
  idType: string | null
  idNumber: string | null
  nationality: string | null
  dateOfBirth: Date | null
  placeOfBirth: string | null
  placeOfIssue: string | null
  homeAddress: string | null
  contactAddress: string | null
  mobile: string | null
  email: string | null
  sourceOfFunds: string | null
  amlChecks: Array<{ result: string; matches: unknown }>
  roles: string[]
}

// ── Font loading ──────────────────────────────────────────────────────────────
async function loadReportFonts(doc: PDFDocument): Promise<ReportFonts> {
  return loadPdfFonts(doc)
}

// ── Text helpers ──────────────────────────────────────────────────────────────
function normalizePdfText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function drawText(page: PDFPage, text: string, opts: Parameters<PDFPage['drawText']>[1]) {
  page.drawText(normalizePdfText(text), opts)
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const norm = normalizePdfText(text)
  const words = /[\s-]/.test(norm) ? norm.split(/(\s+)/) : Array.from(norm)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? `${cur}${w}` : w
    if (font.widthOfTextAtSize(candidate, size) <= maxW) { cur = candidate }
    else { if (cur) lines.push(cur); cur = w.trimStart() }
  }
  if (cur.trim()) lines.push(cur)
  return lines
}

function cellLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const paragraphs = normalizePdfText(text || '—').split('\n')
  const lines = paragraphs.flatMap((paragraph) => paragraph.trim() ? wrapText(paragraph, font, size, maxW) : [' '])
  return lines.length > 0 ? lines : ['—']
}

function maxTextWidth(lines: string[], font: PDFFont, size: number) {
  return Math.max(...lines.map(line => font.widthOfTextAtSize(line, size)), 0)
}

function dateDisplay(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('en-HK') : '—'
}

function riskColor(level: string | null) {
  if (level === 'HIGH')   return RED
  if (level === 'MEDIUM') return ORANGE
  return GREEN_TEXT
}

function riskLabel(level: string | null | undefined) {
  if (level === 'HIGH') return '高風險  High Risk'
  if (level === 'MEDIUM') return '中風險  Medium Risk'
  if (level === 'LOW') return '低風險  Low Risk'
  return '低風險  Low Risk'
}

function recommendationLabel(value: string | null | undefined) {
  if (value === 'RECOMMEND') return '推薦  Recommend'
  if (value === 'NOT_RECOMMEND') return '不推薦  Not Recommend'
  if (value === 'FURTHER_REVIEW') return '進一步審查  Further Review'
  return '—'
}

function answerColor(answer: string) {
  const normalized = answer.trim().toLowerCase()
  if (normalized.startsWith('是') || normalized.startsWith('yes')) return RED
  return GREEN_TEXT
}

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function personDisplayName(person: Pick<ReportPerson, 'nameEn' | 'nameZh'>) {
  return [person.nameEn, person.nameZh].filter(Boolean).join(' / ')
}

function addRole(person: ReportPerson, role: string) {
  if (!person.roles.includes(role)) person.roles.push(role)
}

function personDetailText(person: ReportPerson) {
  return [
    `身份 Role: ${person.roles.join(', ') || '—'}`,
    `性別 Gender: —`,
    `出生日期 Date of birth: ${dateDisplay(person.dateOfBirth)}`,
    `出生地 Place of birth: ${person.placeOfBirth || '—'}`,
    `國籍 Nationality: ${person.nationality || '—'}`,
    `身份證明 ID: ${[person.idType, person.idNumber].filter(Boolean).join(': ') || '—'}`,
    `簽發地 Place of issue: ${person.placeOfIssue || '—'}`,
    `地址 Address: ${person.contactAddress || person.homeAddress || '—'}`,
    `電話 Mobile: ${person.mobile || '—'}`,
    `電郵 Email: ${person.email || '—'}`,
    `資金來源 Source of funds: ${person.sourceOfFunds || '—'}`,
  ].join('\n')
}

function amlEntityType(person: ReportPerson) {
  if (person.roles.includes('Company')) return 'ENTITY'
  if (person.roles.includes('Member') && !person.idNumber) return 'ENTITY'
  return 'INDIVIDUAL'
}

async function ensureReportAmlCheck(person: ReportPerson) {
  if (person.amlChecks[0]) return

  const { result, matches } = await screenSubjectNames({
    names: [person.nameEn, person.nameZh].filter(Boolean) as string[],
    dateOfBirth: person.dateOfBirth,
    entityType: amlEntityType(person),
  })
  person.amlChecks = [{ result, matches }]
}

function categoryLabel(cats: string[]): string {
  return cats
    .map(c =>
      c === 'CRIME' ? '犯罪/Crime'
        : c === 'PEP' ? 'PEP'
          : c === 'FINANCIAL_FRAUD' ? '金融詐騙/Financial fraud'
            : c,
    )
    .join(', ')
}

async function ensureAdverseMediaForReport(opts: {
  subjectType: 'KEY_PERSON' | 'COMPANY'
  keyPersonId?: string
  companyId?: string
  names: string[]
}) {
  if (!isAdverseMediaConfigured()) return
  try {
    await runAdverseMediaScreen(opts)
  } catch (err) {
    console.error('[DDR] Adverse media search failed:', (err as Error).message)
  }
}

async function drawAdverseMediaSection(
  ps: PageState,
  doc: PDFDocument,
  findings: AdverseMediaFindingView[],
  subjectNameByKey: Map<string, string>,
) {
  await ensureSpace(ps, doc, 40)
  subHeader(ps, '1.3  負面新聞／公開媒體篩查  Adverse Media / News Screening')

  if (!isAdverseMediaConfigured()) {
    drawText(ps.page, '未配置 Google Custom Search（GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX），略過新聞篩查。', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 12
    drawText(ps.page, 'Google CSE not configured — adverse media screening skipped.', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 16
    return
  }

  if (findings.length === 0) {
    drawBanner(ps,
      '未發現與犯罪／PEP／金融詐騙相關的公開新聞命中',
      'No adverse media hits related to crime, PEP, or financial fraud',
      true,
    )
    return
  }

  drawBanner(ps,
    `發現 ${findings.length} 則相關公開新聞／媒體報導`,
    `${findings.length} adverse media hit(s) found — review titles, summaries and links below.`,
    false,
  )

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i]
    const subjectKey = f.keyPersonId ? `kp:${f.keyPersonId}` : f.companyId ? `co:${f.companyId}` : ''
    const subjectName = subjectNameByKey.get(subjectKey) || '—'
    await ensureSpace(ps, doc, 70)
    drawText(ps.page, `${i + 1}. [${categoryLabel(f.categories)}]  ${f.title}`, {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.bold, color: RED,
    })
    ps.y -= 12
    drawText(ps.page, `Subject 對象: ${subjectName}${f.publisher ? `  |  ${f.publisher}` : ''}`, {
      x: MARGIN + 10, y: ps.y, size: 8, font: ps.regular, color: GRAY,
    })
    ps.y -= 11
    const snippet = (f.snippet || '—').replace(/\s+/g, ' ')
    for (const line of wrapText(`摘要 Summary: ${snippet}`, ps.regular, 8, CW - 20)) {
      await ensureSpace(ps, doc, 12)
      drawText(ps.page, line, { x: MARGIN + 10, y: ps.y, size: 8, font: ps.regular, color: BLACK })
      ps.y -= 11
    }
    for (const line of wrapText(`連結 Link: ${f.url}`, ps.regular, 7.5, CW - 20)) {
      await ensureSpace(ps, doc, 11)
      drawText(ps.page, line, { x: MARGIN + 10, y: ps.y, size: 7.5, font: ps.regular, color: PRIMARY })
      ps.y -= 10
    }
    ps.y -= 6
  }
}

// ── Page management ───────────────────────────────────────────────────────────
function newPage(doc: PDFDocument, ps: PageState) {
  ps.page = doc.addPage([W, H])
  ps.y = H - MARGIN
}

async function ensureSpace(ps: PageState, doc: PDFDocument, needed: number) {
  if (ps.y - needed < MARGIN + 20) newPage(doc, ps)
}

// ── Layout primitives ─────────────────────────────────────────────────────────

/** Bold section heading + gold rule (e.g. "1. 反洗錢… AML/CFT Search") */
function sectionHeader(ps: PageState, doc: PDFDocument, text: string) {
  ps.y -= 18
  drawText(ps.page, text, { x: MARGIN, y: ps.y, size: 11, font: ps.bold, color: PRIMARY })
  ps.page.drawLine({
    start: { x: MARGIN, y: ps.y - 10 },
    end:   { x: MARGIN + CW, y: ps.y - 10 },
    thickness: 1.5,
    color: ACCENT,
  })
  ps.y -= 18
}

/** Smaller subsection heading (e.g. "1.1 系統搜尋名稱 System Matching Names") */
function subHeader(ps: PageState, text: string) {
  ps.y -= 12
  drawText(ps.page, text, { x: MARGIN, y: ps.y, size: 9.5, font: ps.bold, color: PRIMARY })
  ps.y -= 10
}

/** Leaf-level heading (e.g. "1.1.1 NG DAIKOO") */
function leafHeader(ps: PageState, text: string) {
  ps.y -= 10
  drawText(ps.page, text, { x: MARGIN, y: ps.y, size: 9, font: ps.bold, color: BLACK })
  ps.y -= 8
}

/** Draw a table header row with TH_BG + column labels */
function drawTableHeader(
  ps: PageState,
  cols: Array<{ label: string; width: number; center?: boolean }>,
  rowH = ROW_H,
) {
  const totalW = cols.reduce((s, c) => s + c.width, 0)
  const lineGroups = cols.map(col => cellLines(col.label, ps.bold, 8.5, col.width - 12))
  const actualRowH = Math.max(rowH, Math.max(...lineGroups.map(lines => lines.length)) * 10 + 10)
  ps.page.drawRectangle({ x: MARGIN, y: ps.y - actualRowH, width: totalW, height: actualRowH, color: TH_BG,
    borderColor: BORDER_C, borderWidth: BORDER_W })
  let x = MARGIN
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]
    const lines = lineGroups[i]
    const startY = ps.y - 10
    lines.forEach((line, lineIndex) => {
      const tw = ps.bold.widthOfTextAtSize(line, 8.5)
      const tx = col.center ? x + (col.width - tw) / 2 : x + 6
      drawText(ps.page, line, { x: tx, y: startY - lineIndex * 10, size: 8.5, font: ps.bold, color: PRIMARY })
    })
    if (x + col.width < MARGIN + totalW) {
      ps.page.drawLine({ start: { x: x + col.width, y: ps.y }, end: { x: x + col.width, y: ps.y - actualRowH },
        thickness: BORDER_W, color: BORDER_C })
    }
    x += col.width
  }
  ps.y -= actualRowH
}

/** Draw a plain data row with bottom border */
function drawTableRow(
  ps: PageState,
  cells: Array<{ text: string; width: number; center?: boolean; color?: ReturnType<typeof rgb>; bg?: ReturnType<typeof rgb> }>,
  rowH = ROW_H,
) {
  const totalW = cells.reduce((s, c) => s + c.width, 0)
  const lineGroups = cells.map(cell => cellLines(cell.text, ps.regular, 8.5, cell.width - 12))
  const actualRowH = Math.max(rowH, Math.max(...lineGroups.map(lines => lines.length)) * 10 + 10)
  ps.page.drawLine({ start: { x: MARGIN, y: ps.y }, end: { x: MARGIN + totalW, y: ps.y }, thickness: BORDER_W, color: BORDER_C })
  // left/right border
  ps.page.drawLine({ start: { x: MARGIN, y: ps.y }, end: { x: MARGIN, y: ps.y - actualRowH }, thickness: BORDER_W, color: BORDER_C })
  ps.page.drawLine({ start: { x: MARGIN + totalW, y: ps.y }, end: { x: MARGIN + totalW, y: ps.y - actualRowH }, thickness: BORDER_W, color: BORDER_C })

  let x = MARGIN
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const lines = lineGroups[i]
    if (cell.bg) {
      ps.page.drawRectangle({ x, y: ps.y - actualRowH, width: cell.width, height: actualRowH, color: cell.bg })
    }
    const tw = maxTextWidth(lines, ps.regular, 8.5)
    const tx = cell.center ? x + (cell.width - tw) / 2 : x + 6
    const startY = ps.y - 10
    lines.forEach((line, lineIndex) => {
      drawText(ps.page, line, { x: tx, y: startY - lineIndex * 10, size: 8.5, font: ps.regular, color: cell.color ?? BLACK })
    })
    if (x + cell.width < MARGIN + totalW) {
      ps.page.drawLine({ start: { x: x + cell.width, y: ps.y }, end: { x: x + cell.width, y: ps.y - actualRowH }, thickness: BORDER_W, color: BORDER_C })
    }
    x += cell.width
  }
  ps.page.drawLine({ start: { x: MARGIN, y: ps.y - actualRowH }, end: { x: MARGIN + totalW, y: ps.y - actualRowH }, thickness: BORDER_W, color: BORDER_C })
  ps.y -= actualRowH
}

/**
 * Draw a two-column label/value info box (like the 類型 Type box in 1.1.x).
 * Followed by an optional full-width detail row.
 */
function drawInfoBox(
  ps: PageState,
  rows: Array<{ label: string; value: string; valueColor?: ReturnType<typeof rgb> }>,
  detailText?: string,
) {
  const LABEL_W = 140
  // outer top border
  ps.page.drawLine({ start: { x: MARGIN, y: ps.y }, end: { x: MARGIN + CW, y: ps.y }, thickness: BORDER_W, color: BORDER_C })
  for (const row of rows) {
    const labelLines = cellLines(row.label, ps.bold, 8.5, LABEL_W - 12)
    const valueLines = cellLines(row.value, ps.regular, 8.5, CW - LABEL_W - 12)
    const rh = Math.max(ROW_H, Math.max(labelLines.length, valueLines.length) * 10 + 10)
    // label cell bg
    ps.page.drawRectangle({ x: MARGIN, y: ps.y - rh, width: LABEL_W, height: rh, color: TH_BG })
    // left border
    ps.page.drawLine({ start: { x: MARGIN, y: ps.y }, end: { x: MARGIN, y: ps.y - rh }, thickness: BORDER_W, color: BORDER_C })
    // right border
    ps.page.drawLine({ start: { x: MARGIN + CW, y: ps.y }, end: { x: MARGIN + CW, y: ps.y - rh }, thickness: BORDER_W, color: BORDER_C })
    // divider
    ps.page.drawLine({ start: { x: MARGIN + LABEL_W, y: ps.y }, end: { x: MARGIN + LABEL_W, y: ps.y - rh }, thickness: BORDER_W, color: BORDER_C })
    labelLines.forEach((line, i) => {
      drawText(ps.page, line, { x: MARGIN + 6, y: ps.y - 10 - i * 10, size: 8.5, font: ps.bold, color: PRIMARY })
    })
    valueLines.forEach((line, i) => {
      drawText(ps.page, line, { x: MARGIN + LABEL_W + 6, y: ps.y - 10 - i * 10, size: 8.5, font: ps.regular, color: row.valueColor ?? BLACK })
    })
    ps.page.drawLine({ start: { x: MARGIN, y: ps.y - rh }, end: { x: MARGIN + CW, y: ps.y - rh }, thickness: BORDER_W, color: BORDER_C })
    ps.y -= rh
  }
  if (detailText !== undefined) {
    const detailLines = cellLines(detailText, ps.regular, 8, CW - 12)
    const DH = Math.max(20, detailLines.length * 10 + 10)
    ps.page.drawLine({ start: { x: MARGIN, y: ps.y }, end: { x: MARGIN, y: ps.y - DH }, thickness: BORDER_W, color: BORDER_C })
    ps.page.drawLine({ start: { x: MARGIN + CW, y: ps.y }, end: { x: MARGIN + CW, y: ps.y - DH }, thickness: BORDER_W, color: BORDER_C })
    detailLines.forEach((line, i) => {
      drawText(ps.page, line, { x: MARGIN + 6, y: ps.y - 10 - i * 10, size: 8, font: ps.regular, color: GRAY })
    })
    ps.page.drawLine({ start: { x: MARGIN, y: ps.y - DH }, end: { x: MARGIN + CW, y: ps.y - DH }, thickness: BORDER_W, color: BORDER_C })
    ps.y -= DH
  }
}

async function drawAssessmentTable(
  ps: PageState,
  doc: PDFDocument,
  items: Array<{ question: string; answer: string; notes?: string | null }>,
) {
  const COL_Q = Math.floor(CW * 0.75)
  const COL_A = CW - COL_Q
  drawTableHeader(ps, [
    { label: '項目\nQuestion', width: COL_Q },
    { label: '答案\nAnswer', width: COL_A, center: true },
  ], 28)
  for (const item of items) {
    await ensureSpace(ps, doc, 120)
    drawTableRow(ps, [
      { text: item.notes ? `${item.question}\n備註 Notes: ${item.notes}` : item.question, width: COL_Q },
      { text: item.answer, width: COL_A, center: true, color: answerColor(item.answer) },
    ], 54)
  }
}

async function drawApprovalBox(
  ps: PageState,
  doc: PDFDocument,
  title: string,
  rows: Array<{ label: string; value: string; valueColor?: ReturnType<typeof rgb>; tall?: boolean }>,
) {
  await ensureSpace(ps, doc, 180)
  subHeader(ps, title)
  drawInfoBox(
    ps,
    rows.map(row => ({
      label: row.label,
      value: row.tall ? `${row.value}\n\n簽署  Signature` : row.value,
      valueColor: row.valueColor,
    })),
  )
  ps.y -= 18
}

/** Draw a coloured banner (green for clear, red for alert) */
function drawBanner(ps: PageState, text: string, bold: string, isGood: boolean) {
  const BH = 40
  const bgColor = isGood ? GREEN_BG : RED_BG
  const fgColor = isGood ? GREEN_TEXT : RED
  ps.page.drawRectangle({ x: MARGIN, y: ps.y - BH, width: CW, height: BH, color: bgColor,
    borderColor: isGood ? GREEN_TEXT : RED, borderWidth: 0.75 })
  // checkmark / cross
  drawText(ps.page, isGood ? '✓' : '✗', { x: MARGIN + 10, y: ps.y - 16, size: 11, font: ps.bold, color: fgColor })
  drawText(ps.page, text, { x: MARGIN + 26, y: ps.y - 14, size: 8.5, font: ps.regular, color: fgColor })
  drawText(ps.page, bold, { x: MARGIN + 26, y: ps.y - 28, size: 9, font: ps.bold, color: fgColor })
  ps.y -= BH + 6
}

/** Render a simple key: value field row (for the conclusion section) */
function field(ps: PageState, label: string, value: string, valueColor?: ReturnType<typeof rgb>) {
  ps.y -= 14
  drawText(ps.page, label + ':', { x: MARGIN + 4, y: ps.y, size: 9, font: ps.bold, color: GRAY })
  const lines = wrapText(value || '—', ps.regular, 9, CW - 130)
  lines.forEach((line, i) => {
    drawText(ps.page, line, { x: MARGIN + 130, y: ps.y - i * 12, size: 9, font: ps.regular, color: valueColor ?? BLACK })
  })
  if (lines.length > 1) ps.y -= (lines.length - 1) * 12
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateDDR(companyId: string, ddrId?: string): Promise<Buffer> {
  const { generateCompanyDdrDocx } = await import('@/lib/docgen/ddr-docx')
  return generateCompanyDdrDocx(companyId, ddrId)
}


// ─────────────────────────────────────────────────────────────────────────────
// Person-level Due Diligence Report
// ─────────────────────────────────────────────────────────────────────────────

/** Parse stored AML check matches JSON into display rows. */
function parseMatchRows(matches: unknown): Array<{ primaryName: string; score: number; result: string }> {
  if (!Array.isArray(matches)) return []
  const rows: Array<{ primaryName: string; score: number; result: string }> = []
  for (const m of matches) {
    if (!m || typeof m !== 'object') continue
    const row = m as { primaryName?: unknown; score?: unknown; result?: unknown }
    if (typeof row.primaryName !== 'string') continue
    rows.push({
      primaryName: row.primaryName,
      score: typeof row.score === 'number' ? row.score : 0,
      result: typeof row.result === 'string' ? row.result : 'WEAK_HIT',
    })
  }
  return rows
}

function screeningResultColor(result: string | null | undefined) {
  if (result === 'CLEAR') return GREEN_TEXT
  if (result === 'STRONG_HIT') return RED
  if (!result) return GRAY
  return ORANGE
}

function screeningResultLabel(result: string | null | undefined): string {
  if (!result) return '未完成  Not completed'
  if (result === 'CLEAR') return 'CLEAR  清白'
  if (result === 'STRONG_HIT') return 'HIT  命中'
  return result.replace(/_/g, ' ')
}

function resolutionLabel(resolution: string | null | undefined): string {
  switch (resolution) {
    case 'FALSE_POSITIVE':
      return '誤報  False Positive'
    case 'CONFIRMED':
      return '已確認  Confirmed'
    case 'ESCALATED':
      return '已升級（EDD）  Escalated (EDD)'
    case 'REJECTED':
      return '拒絕／終止  Rejected'
    case 'PENDING':
      return '待審查  Pending'
    default:
      return resolution ? resolution.replace(/_/g, ' ') : '待決議  Pending'
  }
}

type PersonScopedCheck = {
  result: string
  checkedAt: Date
  matches: unknown
  triggeredBy: { nameEn: string | null; nameZh: string | null } | null
}

type AlertDispositionRow = {
  resolution: string
  reviewNotes: string | null
  reviewedAt: Date | null
  reviewedByName: string
  evidenceFileName: string | null
  matchName: string
  sourceName: string
  listingReason: string | null
  isPepish: boolean
}

type SupportingFileRow = {
  fileName: string
  uploadedAt: Date | null
}

async function loadPersonScopedChecks(keyPersonId: string): Promise<Record<
  'SANCTIONS' | 'FATF' | 'PEP' | 'ADVERSE_MEDIA',
  PersonScopedCheck | null
>> {
  const scopes = ['SANCTIONS', 'FATF', 'PEP', 'ADVERSE_MEDIA'] as const
  const entries = await Promise.all(
    scopes.map(async scope => {
      const check = await prisma.aMLCheck.findFirst({
        where: { keyPersonId, subjectType: 'KEY_PERSON', scope },
        orderBy: { checkedAt: 'desc' },
        select: {
          result: true,
          checkedAt: true,
          matches: true,
          triggeredBy: { select: { nameEn: true, nameZh: true } },
        },
      })
      return [scope, check] as const
    }),
  )
  return Object.fromEntries(entries) as Record<
    'SANCTIONS' | 'FATF' | 'PEP' | 'ADVERSE_MEDIA',
    PersonScopedCheck | null
  >
}

async function loadKeyPersonAlertDispositions(keyPersonId: string): Promise<AlertDispositionRow[]> {
  const alerts = await prisma.aMLAlert.findMany({
    where: { keyPersonId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      resolution: true,
      reviewNotes: true,
      reviewedAt: true,
      evidenceFileName: true,
      reviewedBy: { select: { nameEn: true, nameZh: true } },
      amlRecord: {
        select: {
          primaryName: true,
          listingReason: true,
          source: { select: { nameEn: true } },
        },
      },
    },
  })

  return alerts.map(a => {
    const listingReason = a.amlRecord.listingReason
    const sourceName = a.amlRecord.source.nameEn
    const hay = `${listingReason ?? ''} ${sourceName}`.toLowerCase()
    const isPepish = hay.includes('pep') || hay.includes('opensanctions') || hay.includes('role.pep')
    return {
      resolution: a.resolution,
      reviewNotes: a.reviewNotes,
      reviewedAt: a.reviewedAt,
      reviewedByName: [a.reviewedBy?.nameEn, a.reviewedBy?.nameZh].filter(Boolean).join(' / ') || '—',
      evidenceFileName: a.evidenceFileName,
      matchName: a.amlRecord.primaryName,
      sourceName,
      listingReason,
      isPepish,
    }
  })
}

function manualNotesFromCheck(check: PersonScopedCheck | null): string | null {
  if (!check?.matches || typeof check.matches !== 'object' || Array.isArray(check.matches)) return null
  const meta = check.matches as { manual?: boolean; notes?: string | null }
  if (!meta.manual) return null
  return meta.notes?.trim() || null
}

/** Draw hit / resolution / supporting evidence for a screening step. */
async function drawHitDisposition(
  ps: PageState,
  doc: PDFDocument,
  opts: {
    isHit: boolean
    alerts?: AlertDispositionRow[]
    supportingFiles?: SupportingFileRow[]
    manualNotes?: string | null
  },
) {
  await ensureSpace(ps, doc, 56)
  drawText(ps.page, '命中與處置  Hit & Disposition', {
    x: MARGIN + 4, y: ps.y, size: 9, font: ps.bold, color: BLACK,
  })
  ps.y -= 12

  const rows: Array<{ label: string; value: string; valueColor?: ReturnType<typeof rgb> }> = [
    {
      label: '是否命中\nHit',
      value: opts.isHit ? '是  Yes' : '否  No',
      valueColor: opts.isHit ? RED : GREEN_TEXT,
    },
  ]

  if (!opts.isHit) {
    drawInfoBox(ps, rows)
    ps.y -= 6
    return
  }

  const alerts = opts.alerts ?? []
  if (alerts.length === 0) {
    rows.push({ label: '決議\nResolution', value: '待審查／見備註  Pending / see notes' })
    if (opts.manualNotes) {
      rows.push({ label: '審查備註\nReview Notes', value: opts.manualNotes })
    } else {
      rows.push({ label: '審查備註\nReview Notes', value: '無備註  No Remark' })
    }
  } else {
    for (let i = 0; i < alerts.length; i++) {
      const a = alerts[i]!
      const prefix = alerts.length > 1 ? `[${i + 1}] ` : ''
      rows.push({
        label: `${prefix}匹配記錄\nMatch`,
        value: `${a.matchName} · ${a.sourceName}${a.listingReason ? ` (${a.listingReason})` : ''}`,
      })
      rows.push({
        label: `${prefix}決議\nResolution`,
        value: resolutionLabel(a.resolution),
      })
      rows.push({
        label: `${prefix}審查備註\nReview Notes`,
        value: a.reviewNotes?.trim() || '無備註  No Remark',
      })
      rows.push({
        label: `${prefix}審查人／日期\nReviewer / Date`,
        value: `${a.reviewedByName} · ${a.reviewedAt ? new Date(a.reviewedAt).toLocaleString('en-HK') : '—'}`,
      })
      if (a.evidenceFileName) {
        rows.push({ label: `${prefix}支持文件\nSupporting`, value: a.evidenceFileName })
      }
    }
  }

  const files = opts.supportingFiles ?? []
  if (files.length > 0) {
    rows.push({
      label: '支持文件\nSupporting document(s)',
      value: files
        .map(f => `${f.fileName}${f.uploadedAt ? ` (${new Date(f.uploadedAt).toLocaleDateString('en-HK')})` : ''}`)
        .join('\n'),
    })
  } else if (!alerts.some(a => a.evidenceFileName)) {
    rows.push({ label: '支持文件\nSupporting document(s)', value: '無  None' })
  }

  drawInfoBox(ps, rows)
  ps.y -= 6
}

/** Draw one audit-ready screening proof block (result + timestamp + hit disposition). */
async function drawScreeningProofBlock(
  ps: PageState,
  doc: PDFDocument,
  opts: {
    title: string
    methodZh: string
    methodEn: string
    check: PersonScopedCheck | null
    subjectLines?: string[]
    emptyClearMessage?: { zh: string; en: string }
    dispositions?: AlertDispositionRow[]
    supportingFiles?: SupportingFileRow[]
  },
) {
  await ensureSpace(ps, doc, 80)
  subHeader(ps, opts.title)

  const check = opts.check
  const isClear = check?.result === 'CLEAR'
  const isGood = Boolean(check && isClear)
  const isHit = Boolean(check && check.result !== 'CLEAR')

  drawBanner(
    ps,
    check
      ? `結果 Result: ${screeningResultLabel(check.result)}`
      : '尚未完成此步驟篩查  This screening step has not been completed',
    check
      ? `完成時間 Completed: ${new Date(check.checkedAt).toLocaleString('en-HK')}`
      : '請先於 KYC 完成對應步驟  Complete the KYC step first',
    isGood,
  )

  const officer = check?.triggeredBy
    ? [check.triggeredBy.nameEn, check.triggeredBy.nameZh].filter(Boolean).join(' / ')
    : '—'
  drawInfoBox(ps, [
    { label: '方法  Method', value: `${opts.methodZh}\n${opts.methodEn}` },
    {
      label: '結果  Result',
      value: screeningResultLabel(check?.result),
      valueColor: screeningResultColor(check?.result),
    },
    {
      label: '完成時間\nCompleted at',
      value: check ? new Date(check.checkedAt).toLocaleString('en-HK') : '—',
    },
    { label: '操作人員\nPerformed by', value: officer },
  ])
  ps.y -= 4

  if (opts.subjectLines && opts.subjectLines.length > 0) {
    await ensureSpace(ps, doc, 40)
    drawText(ps.page, '篩查對象 / 輸入欄位  Screening inputs:', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.bold, color: BLACK,
    })
    ps.y -= 12
    for (const line of opts.subjectLines) {
      await ensureSpace(ps, doc, 12)
      for (const wrapped of wrapText(line, ps.regular, 8.5, CW - 16)) {
        drawText(ps.page, wrapped, { x: MARGIN + 8, y: ps.y, size: 8.5, font: ps.regular, color: GRAY })
        ps.y -= 11
      }
    }
    ps.y -= 4
  }

  const matchRows = parseMatchRows(check?.matches)
  if (matchRows.length > 0) {
    await ensureSpace(ps, doc, 36)
    drawText(ps.page, '命中明細  Match evidence:', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.bold, color: BLACK,
    })
    ps.y -= 12
    for (const m of matchRows) {
      await ensureSpace(ps, doc, 14)
      const line = `• ${m.primaryName}  (${m.result.replace(/_/g, ' ')}${m.score ? `  ${(m.score * 100).toFixed(0)}%` : ''})`
      drawText(ps.page, line, {
        x: MARGIN + 8,
        y: ps.y,
        size: 8.5,
        font: ps.regular,
        color: screeningResultColor(m.result),
      })
      ps.y -= 13
    }
  } else if (check?.result === 'CLEAR' && opts.emptyClearMessage) {
    await ensureSpace(ps, doc, 36)
    drawBanner(ps, opts.emptyClearMessage.zh, opts.emptyClearMessage.en, true)
  } else if (isHit && matchRows.length === 0) {
    await ensureSpace(ps, doc, 24)
    drawText(ps.page, '已標記為命中（無結構化命中明細）。  Marked as HIT (no structured match rows).', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: RED,
    })
    ps.y -= 14
  }

  await drawHitDisposition(ps, doc, {
    isHit: Boolean(check) && isHit,
    alerts: opts.dispositions,
    supportingFiles: opts.supportingFiles,
    manualNotes: manualNotesFromCheck(check),
  })

  ps.y -= 8
}

async function drawPart4Conclusion(
  ps: PageState,
  doc: PDFDocument,
  opts: {
    subjectLabel: string
    allClear: boolean
    clearBannerZh: string
    clearBannerEn: string
    incompleteBannerZh: string
    incompleteBannerEn: string
    riskLevel: string | null | undefined
    riskRemark?: string | null
    reportDate?: Date | string | null
    checklist?: Array<{ label: string; ok: boolean; detail: string }>
  },
) {
  await ensureSpace(ps, doc, 80)
  sectionHeader(ps, doc, '4. 結論  Conclusion')

  if (opts.checklist && opts.checklist.length > 0) {
    await ensureSpace(ps, doc, 36)
    subHeader(ps, '4.1  篩查摘要  Screening Summary')
    for (const row of opts.checklist) {
      await ensureSpace(ps, doc, 16)
      drawText(ps.page, `${row.ok ? '✓' : '○'}  ${row.label}`, {
        x: MARGIN + 8, y: ps.y, size: 9, font: ps.bold, color: row.ok ? GREEN_TEXT : GRAY,
      })
      drawText(ps.page, row.detail, {
        x: MARGIN + 240, y: ps.y, size: 8.5, font: ps.regular,
        color: row.ok ? GREEN_TEXT : ORANGE,
      })
      ps.y -= 15
    }
    ps.y -= 4
  }

  if (opts.allClear) {
    drawBanner(ps, opts.clearBannerZh, opts.clearBannerEn, true)
  } else {
    drawBanner(ps, opts.incompleteBannerZh, opts.incompleteBannerEn, false)
  }

  const riskText = riskLabel(opts.riskLevel ?? null)
  const riskCol = riskColor(opts.riskLevel ?? null)
  const remark = opts.riskRemark?.trim() || '無備註  No Remark'

  const narrativeZh = opts.allClear
    ? `經過全面的盡職審查，${opts.subjectLabel} 被評估為${riskText.split('  ')[0] ?? '低風險'}客戶，未發現未決議之重大篩查命中。`
    : `經過盡職審查，${opts.subjectLabel} 之篩查尚未全部 CLEAR，或存在命中／待決議事項，整體風險評定為 ${riskText.split('  ')[0] ?? '—'}。`
  const narrativeEn = opts.allClear
    ? `After comprehensive due diligence, ${opts.subjectLabel} is assessed as ${riskText.split('  ')[1] ?? 'Low Risk'} with no unresolved material screening hits.`
    : `After due diligence, screening for ${opts.subjectLabel} is not fully CLEAR or has unresolved hits; overall risk is assessed as ${riskText.split('  ')[1] ?? '—'}.`

  await ensureSpace(ps, doc, 40)
  for (const line of wrapText(narrativeZh, ps.regular, 9, CW - 8)) {
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 9, font: ps.regular, color: BLACK })
    ps.y -= 12
  }
  for (const line of wrapText(narrativeEn, ps.regular, 8.5, CW - 8)) {
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
  ps.y -= 8

  await drawApprovalBox(ps, doc, '4.2  整體風險與批准  Overall Risk & Approver', [
    { label: '整體風險等級\nOverall Risk Level', value: riskText, valueColor: riskCol },
    { label: '風險備註\nRisk Remark', value: remark },
    {
      label: 'Approver\n批准人員',
      value: 'Wong Sze Kai',
    },
    {
      label: '批准日期\nApproval Date',
      value: new Date(opts.reportDate ?? new Date()).toLocaleDateString('en-HK'),
    },
  ])
}

async function drawPart5DataSources(
  ps: PageState,
  doc: PDFDocument,
  amlSources: Array<{ seqNo: number; nameEn: string; nameZh: string; sourceUrl?: string; lastFetched: Date | null }>,
  fmt: (d: Date | string | null | undefined) => string,
) {
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '5. 資料來源與說明  Data Sources and Notes')

  await ensureSpace(ps, doc, 28)
  subHeader(ps, '5.1  制裁名單資料來源  Sanctions List Data Sources')
  for (const line of wrapText(
    '本報告反洗錢／打擊恐怖融資查詢監控以下制裁名單來源（系統定期更新）。The AML/CFT search monitors the following sanctions list sources.',
    ps.regular, 8.5, CW - 8,
  )) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: BLACK })
    ps.y -= 11
  }
  ps.y -= 4

  if (amlSources.length === 0) {
    drawText(ps.page, '暫無資料來源記錄。  No data source records available.', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 14
  } else {
    const COL_SEQ = 32
    const COL_NAME = Math.floor((CW - COL_SEQ) * 0.42)
    const COL_URL = Math.floor((CW - COL_SEQ) * 0.4)
    const COL_FETCH = CW - COL_SEQ - COL_NAME - COL_URL
    drawTableHeader(ps, [
      { label: '序號\nNo.', width: COL_SEQ, center: true },
      { label: '名單名稱\nList Name', width: COL_NAME },
      { label: '來源\nSource URL', width: COL_URL },
      { label: '更新\nUpdated', width: COL_FETCH, center: true },
    ], 28)
    for (const src of amlSources) {
      await ensureSpace(ps, doc, ROW_H + 8)
      drawTableRow(ps, [
        { text: String(src.seqNo), width: COL_SEQ, center: true },
        { text: `${src.nameZh}\n${src.nameEn}`, width: COL_NAME },
        { text: src.sourceUrl || '—', width: COL_URL },
        { text: fmt(src.lastFetched), width: COL_FETCH, center: true },
      ], 40)
    }
  }
  ps.y -= 8

  await ensureSpace(ps, doc, 80)
  subHeader(ps, '5.2  資料來源說明  Data Source Notes')
  const notes = [
    '• 制裁名單查詢 Sanctions：系統比對國際／本地權威制裁名單資料庫。',
    '• FATF：以系統內建黑名單（Call for Action）及灰名單（Increased Monitoring）JSON 審閱司法管轄區（國籍／證件簽發地／出生地）。',
    '• PEP：OpenSanctions.org Match API（/match/peps）即時比對；非本機下載名單。',
    '• 負面新聞 Adverse media：合規人員人工審查公開資訊後於系統標記 CLEAR／HIT；可附支持文件；不依賴 Google／Web AI。',
    '• 公司／個人基本資料：客戶提供及／或香港公司註冊處等公開記錄。',
    '• 實益擁有人（公司報告）：穿透後有效權益超過 25%（AMLO / CR TCSP Guideline）。',
  ]
  for (const n of notes) {
    for (const line of wrapText(n, ps.regular, 8.5, CW - 8)) {
      await ensureSpace(ps, doc, 12)
      drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: BLACK })
      ps.y -= 11
    }
  }
  ps.y -= 6

  await ensureSpace(ps, doc, 50)
  subHeader(ps, '5.3  報告有效性  Report Validity')
  for (const line of wrapText(
    '本報告資料截至報告日期為準。資料如有變更，應重新進行盡職審查。建議定期更新以確保合規性。Report data is current as of the generation date; re-conduct CDD when information changes.',
    ps.regular, 8.5, CW - 8,
  )) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
}

async function drawPart6Disclaimer(ps: PageState, doc: PDFDocument) {
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '6. 免責聲明  Disclaimer')
  for (const line of wrapText(
    '本報告基於報告當日可獲得之系統存檔及公開資訊編製。資訊的準確性和完整性可能受資料來源限制。本報告僅供內部合規參考，不構成法律意見。',
    ps.regular, 8.5, CW - 8,
  )) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
  for (const line of wrapText(
    'This report is compiled from system records and publicly available information as of the report date. Accuracy and completeness may be limited by source data. For internal compliance reference only; not legal advice.',
    ps.regular, 8, CW - 8,
  )) {
    await ensureSpace(ps, doc, 11)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 10
  }
}

export async function generatePersonDDR(keyPersonId: string): Promise<Buffer> {
  const { generatePersonDdrDocx } = await import('@/lib/docgen/ddr-docx')
  return generatePersonDdrDocx(keyPersonId)
}
