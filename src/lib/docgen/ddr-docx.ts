/**
 * DDR report renderer — Word (.docx) with 6AM Advisory branding.
 * Print → sign → upload workflow (signed scan as PDF/JPG/PNG).
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  VerticalAlign,
  convertInchesToTwip,
} from 'docx'
import type { IRunOptions } from 'docx'
import { prisma } from '@/lib/db/prisma'
import {
  collectCompanyDdrScreeningSubjects,
  type OwnershipNode,
} from '@/lib/aml/ownershipLookThrough'
import { DEFAULT_RISK_ITEMS } from '@/lib/docgen/ddr-risk-items'

const FIRM_NAME = '6AM Advisory Limited'
const PAGE_W = convertInchesToTwip(8.27) // A4
const MARGIN = convertInchesToTwip(0.7)
const CONTENT_W = PAGE_W - MARGIN * 2

const thin = { style: BorderStyle.SINGLE, size: 4, color: '666666' }
const borders = { top: thin, bottom: thin, left: thin, right: thin }
const headerFill = 'D9D9D9'
const cellM = { top: 60, bottom: 60, left: 80, right: 80 }

function fmt(d: Date | string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('en-HK') : '—'
}

function fmtDt(d: Date | string | null | undefined) {
  return d ? new Date(d).toLocaleString('en-HK') : '—'
}

function dash(v: string | null | undefined) {
  const t = v?.trim()
  return t ? t : '—'
}

function normalizeMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function screeningResultLabel(result: string | null | undefined): string {
  if (!result) return '未完成  Not completed'
  if (result === 'CLEAR') return '通過 CLEAR'
  if (result === 'STRONG_HIT') return '命中 HIT'
  return result.replace(/_/g, ' ')
}

function resolutionLabel(resolution: string | null | undefined): string {
  switch (resolution) {
    case 'FALSE_POSITIVE': return '誤報  False Positive'
    case 'CONFIRMED': return '已確認  Confirmed'
    case 'ESCALATED': return '已升級  Escalated'
    case 'PENDING': return '待審查  Pending'
    default: return resolution ? resolution.replace(/_/g, ' ') : '待決議  Pending'
  }
}

function riskLabel(level: string | null | undefined) {
  if (level === 'HIGH') return '高風險  High Risk'
  if (level === 'MEDIUM') return '中風險  Medium Risk'
  if (level === 'LOW') return '低風險  Low Risk'
  return '低風險  Low Risk'
}

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

function manualNotesFromCheck(check: PersonScopedCheck | null): string | null {
  if (!check?.matches || typeof check.matches !== 'object' || Array.isArray(check.matches)) return null
  const meta = check.matches as { manual?: boolean; notes?: string | null }
  if (!meta.manual) return null
  return meta.notes?.trim() || null
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

async function loadPersonScopedChecks(keyPersonId: string) {
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
  return Object.fromEntries(entries) as Record<(typeof scopes)[number], PersonScopedCheck | null>
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

function runs(text: string, opts: Partial<IRunOptions> = {}) {
  return text.split('\n').flatMap((line, i) => [
    ...(i > 0 ? [new TextRun({ break: 1, ...opts })] : []),
    new TextRun({ text: line, ...opts }),
  ])
}

function p(text: string, opts: Partial<IRunOptions> & { spacingAfter?: number; spacingBefore?: number } = {}) {
  const { spacingAfter = 80, spacingBefore = 0, ...runOpts } = opts
  return new Paragraph({
    spacing: { after: spacingAfter, before: spacingBefore },
    children: runs(text, { size: 18, ...runOpts }),
  })
}

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
    children: [new TextRun({ text, bold: true, size: 22 })],
  })
}

function subTitle(text: string) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 20 })],
  })
}

function kvTable(rows: Array<{ label: string; value: string }>) {
  const labelW = Math.floor(CONTENT_W * 0.32)
  const valueW = CONTENT_W - labelW
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    rows: rows.map(row => new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: labelW, type: WidthType.DXA },
          margins: cellM,
          shading: { fill: headerFill },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: runs(row.label, { bold: true, size: 17 }) })],
        }),
        new TableCell({
          borders,
          width: { size: valueW, type: WidthType.DXA },
          margins: cellM,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: runs(row.value || '—', { size: 17 }) })],
        }),
      ],
    })),
  })
}

function dataTable(headers: string[], widths: number[], body: string[][]) {
  const head = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: cellM,
      shading: { fill: headerFill },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: runs(h, { bold: true, size: 16 }) })],
    })),
  })
  const rows = body.map(cells => new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: cellM,
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({ children: runs(c || '—', { size: 16 }) })],
    })),
  }))
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [head, ...rows],
  })
}

function loadLogo(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'))
  } catch {
    return null
  }
}

function brandHeader(logo: Buffer | null, reportTitleZh: string, reportTitleEn: string) {
  const children: Paragraph[] = []
  if (logo) {
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new ImageRun({
          type: 'png',
          data: logo,
          transformation: { width: 28, height: 28 },
          altText: { name: 'logo', title: FIRM_NAME, description: FIRM_NAME },
        }),
        new TextRun({ text: `  ${FIRM_NAME}`, bold: true, size: 20 }),
      ],
    }))
  } else {
    children.push(p(FIRM_NAME, { bold: true, size: 20, spacingAfter: 40 }))
  }
  children.push(p(reportTitleZh, { bold: true, size: 18, spacingAfter: 20 }))
  children.push(p(reportTitleEn, { size: 16, spacingAfter: 40 }))
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
    children: [],
  }))
  return new Header({ children })
}

function brandFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 8 } },
        children: [
          new TextRun({ text: `${FIRM_NAME}  ·  機密 Confidential  ·  `, size: 14, color: '666666' }),
          new TextRun({ text: '第 ', size: 14, color: '666666' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '666666' }),
          new TextRun({ text: ' 頁 / Page ', size: 14, color: '666666' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '666666' }),
        ],
      }),
    ],
  })
}

type ScreeningBlockInput = {
  title: string
  methodZh: string
  methodEn: string
  check: PersonScopedCheck | null
  subjectLines?: string[]
  emptyClearMessage?: { zh: string; en: string }
  dispositions?: AlertDispositionRow[]
  supportingFiles?: Array<{ fileName: string; uploadedAt: Date | null }>
  /** When true, show「沒有搜索到相關信息」if supportingFiles is empty */
  showSupportingEmpty?: boolean
}

function screeningBlock(opts: ScreeningBlockInput): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = []
  out.push(subTitle(opts.title))
  const officer = opts.check?.triggeredBy
    ? [opts.check.triggeredBy.nameEn, opts.check.triggeredBy.nameZh].filter(Boolean).join(' / ')
    : '—'
  out.push(kvTable([
    { label: '方法\nMethod', value: `${opts.methodZh}\n${opts.methodEn}` },
    { label: '結果\nResult', value: screeningResultLabel(opts.check?.result) },
    { label: '完成時間\nCompleted at', value: opts.check ? fmtDt(opts.check.checkedAt) : '—' },
    { label: '操作人員\nPerformed by', value: officer },
  ]))

  if (opts.subjectLines?.length) {
    out.push(p('篩查對象 / 輸入欄位  Screening inputs:', { bold: true, size: 17, spacingBefore: 120 }))
    for (const line of opts.subjectLines) out.push(p(line, { size: 16, spacingAfter: 40 }))
  }

  const matches = parseMatchRows(opts.check?.matches)
  const isClear = opts.check?.result === 'CLEAR'
  const isHit = Boolean(opts.check && opts.check.result !== 'CLEAR')

  if (matches.length > 0) {
    out.push(p('命中明細  Match evidence:', { bold: true, size: 17, spacingBefore: 120 }))
    for (const m of matches) {
      out.push(p(
        `• ${m.primaryName}  (${m.result.replace(/_/g, ' ')}${m.score ? `  ${(m.score * 100).toFixed(0)}%` : ''})`,
        { size: 16, spacingAfter: 40 },
      ))
    }
  } else if (isClear && opts.emptyClearMessage) {
    out.push(p(`${opts.emptyClearMessage.zh}\n${opts.emptyClearMessage.en}`, { size: 16, spacingBefore: 100 }))
  } else if (isHit) {
    out.push(p('已標記為命中（無結構化命中明細）。  Marked as HIT (no structured match rows).', { size: 16, spacingBefore: 100 }))
  }

  if (isHit) {
    out.push(p('命中與處置  Hit & Disposition', { bold: true, size: 17, spacingBefore: 140 }))
    const notes = manualNotesFromCheck(opts.check)
    if (notes) out.push(p(`人工備註 Manual notes: ${notes}`, { size: 16 }))
    if (opts.dispositions?.length) {
      for (const d of opts.dispositions) {
        out.push(kvTable([
          { label: '匹配名稱\nMatch', value: d.matchName },
          { label: '來源\nSource', value: d.sourceName },
          { label: '決議\nResolution', value: resolutionLabel(d.resolution) },
          { label: '審查時間\nReviewed at', value: fmtDt(d.reviewedAt) },
          { label: '審查人\nReviewed by', value: d.reviewedByName },
          { label: '備註\nNotes', value: dash(d.reviewNotes) },
          { label: '佐證文件\nEvidence', value: dash(d.evidenceFileName) },
        ]))
      }
    } else {
      out.push(p('尚無警報決議記錄。  No alert disposition on file.', { size: 16 }))
    }
  }

  // Supporting files always listed when present (CLEAR or HIT)
  if (opts.supportingFiles?.length) {
    out.push(p('支持文件  Supporting files:', { bold: true, size: 17, spacingBefore: 80 }))
    const wName = Math.floor(CONTENT_W * 0.7)
    const wDate = CONTENT_W - wName
    out.push(dataTable(
      ['文件名稱\nFile name', '上傳時間\nUploaded at'],
      [wName, wDate],
      opts.supportingFiles.map(f => [f.fileName, fmtDt(f.uploadedAt)]),
    ))
  } else if (opts.showSupportingEmpty) {
    out.push(p('支持文件 Supporting files: 沒有搜索到相關信息\nNo related information found.', { size: 16, spacingBefore: 80 }))
  }

  return out
}

/** Clear bilingual pass/fail for manual adverse media. */
function adverseMediaPassFail(result: string | null | undefined): string {
  if (!result) return '未完成 — 尚未人工標記\nNot completed — manual review not recorded'
  if (result === 'CLEAR') return '通過 CLEAR（人工）\nPASS — manual CLEAR'
  return '不通過／命中 HIT（人工）\nFAIL — manual HIT'
}

type AdverseMedia13Row = {
  subjectLabel: string
  check: PersonScopedCheck | null
  supportingFiles: Array<{ fileName: string; uploadedAt: Date | null }>
}

/** Part 1.3 — manual adverse media with result, time, and supporting files. */
function part13AdverseMedia(rows: AdverseMedia13Row[]): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [
    subTitle('1.3  負面新聞／公開媒體篩查（人工）  Adverse Media / News Screening (Manual)'),
    p(
      '方法 Method：合規人員離線查核公開新聞後於系統人工標記通過／命中（不依賴 Google CSE）。\nStaff review open-source news offline, then mark PASS (CLEAR) or FAIL (HIT) in the system. Google CSE is not required.',
      { size: 16 },
    ),
  ]

  if (rows.length === 0) {
    out.push(p('暫無篩查對象的負面新聞記錄。  No adverse-media records for screening subjects.', { size: 16 }))
    return out
  }

  for (const row of rows) {
    if (rows.length > 1) {
      out.push(p(row.subjectLabel, { bold: true, size: 17, spacingBefore: 140 }))
    }
    const officer = row.check?.triggeredBy
      ? [row.check.triggeredBy.nameEn, row.check.triggeredBy.nameZh].filter(Boolean).join(' / ')
      : '—'
    const notes = manualNotesFromCheck(row.check)
    out.push(kvTable([
      { label: '方法\nMethod', value: '手工審查  Manual review' },
      { label: '通過與否\nPass / Fail', value: adverseMediaPassFail(row.check?.result) },
      { label: '結果代碼\nResult code', value: screeningResultLabel(row.check?.result) },
      { label: '完成時間\nCompleted at', value: row.check ? fmtDt(row.check.checkedAt) : '—' },
      { label: '操作人員\nPerformed by', value: officer },
      { label: '人工備註\nManual notes', value: notes || '—' },
    ]))

    out.push(p('支持文件  Supporting files (KYC_ADVERSE_MEDIA):', { bold: true, size: 17, spacingBefore: 100 }))
    if (row.supportingFiles.length === 0) {
      out.push(p('沒有搜索到相關信息\nNo related information found.', { size: 16, spacingAfter: 60 }))
    } else {
      const wName = Math.floor(CONTENT_W * 0.7)
      const wDate = CONTENT_W - wName
      out.push(dataTable(
        ['文件名稱\nFile name', '上傳時間\nUploaded at'],
        [wName, wDate],
        row.supportingFiles.map(f => [f.fileName, fmtDt(f.uploadedAt)]),
      ))
    }
  }

  return out
}

function ownershipLines(structure: OwnershipNode | null): string[] {
  if (!structure) return ['未能載入股權結構。  Ownership structure unavailable.']
  const lines: string[] = []
  const walk = (node: OwnershipNode, depth: number) => {
    const indent = '  '.repeat(depth)
    const pct = node.ownershipPercent != null ? ` ${node.ownershipPercent.toFixed(2)}%` : ''
    const tag = node.type === 'COMPANY' ? '[公司 Co]' : '[自然人 Person]'
    const circ = node.circular ? ' (circular)' : ''
    lines.push(`${indent}${tag} ${[node.nameEn, node.nameZh].filter(Boolean).join(' / ')}${pct}${circ}`)
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(structure, 0)
  if (lines.length > 80) {
    return [...lines.slice(0, 80), `… and ${lines.length - 80} more node(s)`]
  }
  return lines
}

function buildRiskRows(
  riskAnswers: Array<{ id: string; questionKey: string; answer: string; notes: string | null }>,
) {
  const answerByQuestion = new Map(
    riskAnswers.map(item => [normalizeMatchValue(item.questionKey), item]),
  )
  const used = new Set<string>()
  const defaults = DEFAULT_RISK_ITEMS.map(item => {
    const answer = answerByQuestion.get(normalizeMatchValue(item.question))
    if (answer) used.add(answer.id)
    return {
      question: item.question,
      answer: answer?.answer || '否\nNo',
      notes: answer?.notes ?? null,
    }
  })
  const extras = riskAnswers
    .filter(item => !used.has(item.id))
    .map(item => ({
      question: item.questionKey,
      answer: item.answer,
      notes: item.notes,
    }))
  return [...defaults, ...extras]
}

function part3Risk(items: Array<{ question: string; answer: string; notes: string | null }>) {
  const qW = Math.floor(CONTENT_W * 0.72)
  const aW = CONTENT_W - qW
  return [
    sectionTitle('3. 風險評估項目詳情  Risk Assessment Items Details'),
    dataTable(
      ['項目\nQuestion', '答案\nAnswer'],
      [qW, aW],
      items.map(item => [
        item.notes ? `${item.question}\n備註 Notes: ${item.notes}` : item.question,
        item.answer,
      ]),
    ),
  ]
}

function part4Conclusion(opts: {
  subjectLabel: string
  allClear: boolean
  clearBannerZh: string
  clearBannerEn: string
  incompleteBannerZh: string
  incompleteBannerEn: string
  riskLevel: string | null
  riskRemark: string | null
  approverName: string
  approvalDate: Date | string | null
  approvalNote: string | null
  checklist?: Array<{ label: string; ok: boolean; detail: string }>
}) {
  const out: Array<Paragraph | Table> = [sectionTitle('4. 結論  Conclusion')]
  if (opts.checklist?.length) {
    out.push(subTitle('4.1  篩查摘要  Screening Summary'))
    const w1 = Math.floor(CONTENT_W * 0.55)
    const w2 = Math.floor(CONTENT_W * 0.2)
    const w3 = CONTENT_W - w1 - w2
    out.push(dataTable(
      ['項目\nItem', '狀態\nStatus', '詳情\nDetail'],
      [w1, w2, w3],
      opts.checklist.map(row => [
        row.label,
        row.ok ? '通過 CLEAR' : '待處理 Pending',
        row.detail,
      ]),
    ))
  }

  if (opts.allClear) {
    out.push(p(`${opts.clearBannerZh}\n${opts.clearBannerEn}`, { bold: true, size: 17, spacingBefore: 160 }))
  } else {
    out.push(p(`${opts.incompleteBannerZh}\n${opts.incompleteBannerEn}`, { bold: true, size: 17, spacingBefore: 160 }))
  }

  const riskText = riskLabel(opts.riskLevel)
  const narrativeZh = opts.allClear
    ? `經過全面的盡職審查，${opts.subjectLabel} 被評估為${riskText.split('  ')[0] ?? '低風險'}客戶，未發現未決議之重大篩查命中。`
    : `經過盡職審查，${opts.subjectLabel} 之篩查尚未全部 CLEAR，或存在命中／待決議事項，整體風險評定為 ${riskText.split('  ')[0] ?? '—'}。`
  const narrativeEn = opts.allClear
    ? `After comprehensive due diligence, ${opts.subjectLabel} is assessed as ${riskText.split('  ')[1] ?? 'Low Risk'} with no unresolved material screening hits.`
    : `After due diligence, screening for ${opts.subjectLabel} is not fully CLEAR or has unresolved hits; overall risk is assessed as ${riskText.split('  ')[1] ?? '—'}.`

  out.push(p(narrativeZh, { size: 17, spacingBefore: 120 }))
  out.push(p(narrativeEn, { size: 16, spacingAfter: 120 }))
  out.push(subTitle('4.2  整體風險與批准  Overall Risk & Approver'))
  out.push(kvTable([
    { label: '整體風險等級\nOverall Risk Level', value: riskText },
    { label: '風險備註\nRisk Remark', value: opts.riskRemark?.trim() || '無備註  No Remark' },
    { label: 'Approver\n批准人員', value: opts.approverName || '—' },
    { label: '批准日期\nApproval Date', value: opts.approvalDate ? fmt(opts.approvalDate) : '—' },
    { label: '批准備註\nApproval Remark', value: opts.approvalNote?.trim() || '—' },
    { label: '批准人員簽署\nApprover Signature', value: '\n\n______________________________\n（請列印後簽署  Print & sign）' },
  ]))
  return out
}

function part5Sources(
  amlSources: Array<{ seqNo: number; nameEn: string; nameZh: string; sourceUrl: string | null; lastFetched: Date | null }>,
) {
  const out: Array<Paragraph | Table> = [
    sectionTitle('5. 資料來源與說明  Data Sources and Notes'),
    subTitle('5.1  制裁名單資料來源  Sanctions List Data Sources'),
    p('本報告反洗錢／打擊恐怖融資查詢監控以下制裁名單來源（系統定期更新）。\nThe AML/CFT search monitors the following sanctions list sources.', { size: 16 }),
  ]
  if (amlSources.length === 0) {
    out.push(p('暫無資料來源記錄。  No data source records available.', { size: 16 }))
  } else {
    const w = [
      Math.floor(CONTENT_W * 0.08),
      Math.floor(CONTENT_W * 0.34),
      Math.floor(CONTENT_W * 0.38),
    ]
    w.push(CONTENT_W - w[0] - w[1] - w[2])
    out.push(dataTable(
      ['序號\nNo.', '名單名稱\nList Name', '來源\nSource URL', '更新\nUpdated'],
      w,
      amlSources.map(src => [
        String(src.seqNo),
        `${src.nameZh}\n${src.nameEn}`,
        src.sourceUrl || '—',
        fmt(src.lastFetched),
      ]),
    ))
  }
  out.push(subTitle('5.2  資料來源說明  Data Source Notes'))
  for (const n of [
    '• 制裁名單查詢 Sanctions：系統比對國際／本地權威制裁名單資料庫。',
    '• FATF：以系統內建黑名單（Call for Action）及灰名單（Increased Monitoring）JSON 審閱司法管轄區（國籍／證件簽發地／出生地）。',
    '• PEP：OpenSanctions.org Match API（/match/peps）即時比對；非本機下載名單。',
    '• 負面新聞 Adverse media：合規人員人工審查公開資訊後於系統標記 CLEAR／HIT；可附支持文件；不依賴 Google／Web AI。',
    '• 公司／個人基本資料：客戶提供及／或香港公司註冊處等公開記錄。',
    '• 實益擁有人（公司報告）：穿透後有效權益超過 25%（AMLO / CR TCSP Guideline）。',
  ]) {
    out.push(p(n, { size: 16, spacingAfter: 40 }))
  }
  out.push(subTitle('5.3  報告有效性  Report Validity'))
  out.push(p(
    '本報告資料截至報告日期為準。資料如有變更，應重新進行盡職審查。建議定期更新以確保合規性。\nReport data is current as of the generation date; re-conduct CDD when information changes.',
    { size: 16 },
  ))
  return out
}

function part6Disclaimer() {
  return [
    sectionTitle('6. 免責聲明  Disclaimer'),
    p('本報告基於報告當日可獲得之系統存檔及公開資訊編製。資訊的準確性和完整性可能受資料來源限制。本報告僅供內部合規參考，不構成法律意見。', { size: 16 }),
    p('This report is compiled from system records and publicly available information as of the report date. Accuracy and completeness may be limited by source data. For internal compliance reference only; not legal advice.', { size: 16 }),
  ]
}

function coverBlock(lines: string[]) {
  return [
    p(lines[0], { bold: true, size: 28, spacingBefore: 200, spacingAfter: 60 }),
    p(lines[1], { bold: true, size: 24, spacingAfter: 200 }),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: CONTENT_W, type: WidthType.DXA },
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              children: lines.slice(2).map(t => p(t, { size: 18, spacingAfter: 60 })),
            }),
          ],
        }),
      ],
    }),
    p('本報告依香港 TCSP／AML 合規要求記錄：關鍵身份信息、篩查結果與處置、風險評估、結論與資料來源。', { size: 16, spacingBefore: 200 }),
    p('HK CDD structure: key identity, screening & disposition, risk items, conclusion, data sources.', { size: 15 }),
    p('請列印本 Word 文件，於第 4 部分簽署後掃描上傳存檔。\nPrint this Word file, sign Part 4, then upload the signed scan for filing.', { size: 16, spacingBefore: 160 }),
  ]
}

async function packDoc(opts: {
  titleZh: string
  titleEn: string
  children: Array<Paragraph | Table>
}) {
  const logo = loadLogo()
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: convertInchesToTwip(11.69) },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: {
        default: brandHeader(logo, opts.titleZh, opts.titleEn),
      },
      footers: {
        default: brandFooter(),
      },
      children: opts.children,
    }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

export async function generateCompanyDdrDocx(companyId: string, ddrId?: string): Promise<Buffer> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      id: true,
      nameEn: true,
      nameZh: true,
      companyNumber: true,
      businessRegNumber: true,
      dateOfIncorporation: true,
      registeredAddress: true,
      businessNature: true,
      status: true,
      amlChecks: {
        where: { subjectType: 'COMPANY' },
        orderBy: { checkedAt: 'desc' },
        take: 1,
        select: {
          result: true,
          matches: true,
          checkedAt: true,
          scope: true,
          triggeredBy: { select: { nameEn: true, nameZh: true } },
        },
      },
    },
  })

  const collected = await collectCompanyDdrScreeningSubjects(companyId)
  const structure = collected?.structure ?? null
  const subjects = collected?.subjects ?? []

  const ddr = ddrId
    ? await prisma.dueDiligenceReport.findUniqueOrThrow({ where: { id: ddrId } })
    : await prisma.dueDiligenceReport.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      })

  const riskAnswers = await prisma.riskAssessmentAnswer.findMany({
    where: { companyId },
    orderBy: [{ category: 'asc' }, { questionKey: 'asc' }],
  })

  const amlSources = await prisma.aMLSource.findMany({
    where: { isActive: true, seqNo: { notIn: [16] } },
    orderBy: { seqNo: 'asc' },
    select: { seqNo: true, nameEn: true, nameZh: true, sourceUrl: true, lastFetched: true },
  })

  const approvedByUser = ddr?.approvedById
    ? await prisma.user.findUnique({ where: { id: ddr.approvedById }, select: { nameEn: true, nameZh: true } })
    : null

  const scopedByKp = new Map<string, Awaited<ReturnType<typeof loadPersonScopedChecks>>>()
  const alertsByKp = new Map<string, AlertDispositionRow[]>()
  const supportingByKp = new Map<string, Array<{ fileName: string; uploadedAt: Date | null }>>()
  await Promise.all(
    subjects
      .filter(s => s.keyPersonId)
      .map(async s => {
        const id = s.keyPersonId!
        const [scoped, alerts, evidenceDocs] = await Promise.all([
          loadPersonScopedChecks(id),
          loadKeyPersonAlertDispositions(id),
          prisma.kYCDocument.findMany({
            where: {
              keyPersonId: id,
              documentType: 'KYC_ADVERSE_MEDIA',
              status: { not: 'REJECTED' },
            },
            orderBy: { uploadedAt: 'desc' },
            select: { fileName: true, uploadedAt: true },
          }),
        ])
        scopedByKp.set(id, scoped)
        alertsByKp.set(id, alerts)
        supportingByKp.set(id, evidenceDocs.map(d => ({ fileName: d.fileName, uploadedAt: d.uploadedAt })))
      }),
  )

  const today = fmt(new Date())
  const coDisplay = [company.nameEn, company.nameZh].filter(Boolean).join(' / ')
  const companyCheckRaw = company.amlChecks[0] ?? null
  const companyCheck: PersonScopedCheck | null = companyCheckRaw
    ? {
        result: companyCheckRaw.result,
        checkedAt: companyCheckRaw.checkedAt,
        matches: companyCheckRaw.matches,
        triggeredBy: companyCheckRaw.triggeredBy,
      }
    : null

  const children: Array<Paragraph | Table> = [
    ...coverBlock([
      '公司盡職審查報告',
      'Corporate Due Diligence Report',
      company.nameEn,
      company.nameZh || '',
      company.companyNumber ? `公司編號 Company No.: ${company.companyNumber}` : '',
      `報告日期 Report date: ${today}`,
    ].filter(Boolean)),

    sectionTitle('1. 客戶關鍵信息（篩查相關）  Client Key Information for Screening'),
    kvTable([
      { label: '公司名稱（英文）\nName (EN)', value: company.nameEn },
      { label: '公司名稱（中文）\nName (ZH)', value: company.nameZh || '—' },
      { label: '公司編號\nCompany No.', value: company.companyNumber || '—' },
      { label: '商業登記號\nBR No.', value: company.businessRegNumber || '—' },
      { label: '成立日期\nIncorporation', value: fmt(company.dateOfIncorporation) },
      { label: '註冊地址\nRegistered Address', value: company.registeredAddress || '—' },
      { label: '業務性質\nBusiness Nature', value: company.businessNature || '—' },
      { label: '公司狀態\nStatus', value: company.status || '—' },
    ]),

    subTitle('1.1  股權結構（穿透）  Ownership Structure (Look-through)'),
    p('實益擁有人門檻：穿透後有效權益超過 25%（AMLO / CR TCSP Guideline）。\nUBO threshold: more than 25% effective ownership after look-through.', { size: 16 }),
    ...ownershipLines(structure).map(line => p(line, { size: 15, spacingAfter: 30 })),

    subTitle('1.2  篩查對象  Screening Subjects'),
    p('包括：有效權益>25% 之實益擁有人；全體自然人董事；全體自然人重要控制人。\nIncludes UBOs with effective ownership >25%, all natural-person directors, and all natural-person significant controllers.', { size: 16 }),
  ]

  {
    const w = [
      Math.floor(CONTENT_W * 0.08),
      Math.floor(CONTENT_W * 0.32),
      Math.floor(CONTENT_W * 0.4),
    ]
    w.push(CONTENT_W - w[0] - w[1] - w[2])
    children.push(dataTable(
      ['No.', '姓名\nName', '角色\nRoles', '有效權益\nEffective %'],
      w,
      subjects.map((s, i) => [
        String(i + 1),
        [s.nameEn, s.nameZh].filter(Boolean).join(' / '),
        s.roles.join('; '),
        s.effectivePercent != null ? `${s.effectivePercent.toFixed(2)}%` : '—',
      ]),
    ))
  }

  children.push(...part13AdverseMedia(
    subjects.map(s => ({
      subjectLabel: [s.nameEn, s.nameZh].filter(Boolean).join(' / ') || '—',
      check: s.keyPersonId ? (scopedByKp.get(s.keyPersonId)?.ADVERSE_MEDIA ?? null) : null,
      supportingFiles: s.keyPersonId ? (supportingByKp.get(s.keyPersonId) ?? []) : [],
    })),
  ))

  children.push(sectionTitle('2. 篩查結果與處置  Screening Results & Disposition'))
  children.push(...screeningBlock({
    title: '2.0  公司實體篩查  Company Entity Screening',
    methodZh: '系統比對公司名稱與制裁／AML 名單（公司主體最近一次存檔結果）',
    methodEn: 'Company name screening against AML lists (latest stored company check)',
    check: companyCheck,
    subjectLines: [
      `公司名稱 Name: ${coDisplay}`,
      `公司編號 Company No.: ${company.companyNumber || '—'}`,
      companyCheckRaw?.scope ? `存檔範圍 Stored scope: ${companyCheckRaw.scope}` : '存檔範圍 Stored scope: —',
    ],
    emptyClearMessage: {
      zh: '未發現公司名稱制裁／名單匹配',
      en: 'No company-name sanctions / list matches found',
    },
  }))

  let personIdx = 0
  for (const s of subjects) {
    personIdx += 1
    children.push(subTitle(`2.${personIdx}  ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`))
    children.push(p(`角色 Roles: ${s.roles.join('; ')}`, { size: 16, spacingAfter: 40 }))
    if (s.effectivePercent != null) {
      children.push(p(`穿透後有效權益 Effective ownership: ${s.effectivePercent.toFixed(2)}%`, { size: 16, spacingAfter: 40 }))
    }

    const scoped = s.keyPersonId ? scopedByKp.get(s.keyPersonId) : null
    const alerts = s.keyPersonId ? (alertsByKp.get(s.keyPersonId) ?? []) : []
    if (!scoped) {
      children.push(p(
        '尚無個人四步 KYC 篩查存檔 — 請完成個人 KYC 四步篩查\nNo four-step KYC screening on file — complete individual KYC screening',
        { size: 16 },
      ))
      children.push(kvTable([
        { label: '證件\nID', value: [s.idType, s.idNumber].filter(Boolean).join(': ') || '—' },
        { label: '國籍\nNationality', value: s.nationality || '—' },
        { label: '出生日期\nDOB', value: fmt(s.dateOfBirth) },
        { label: '簽發地／出生地\nIssue / Birth', value: [s.placeOfIssue, s.placeOfBirth].filter(Boolean).join(' / ') || '—' },
      ]))
      continue
    }

    children.push(...screeningBlock({
      title: `${personIdx}.1  制裁名單  Sanctions (AML)`,
      methodZh: '系統比對個人姓名與制裁名單（不含 FATF）',
      methodEn: 'Name screening against sanctions lists (excl. FATF)',
      check: scoped.SANCTIONS,
      subjectLines: [
        `姓名 Name: ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`,
        `出生日期 DOB: ${fmt(s.dateOfBirth)}`,
      ],
      emptyClearMessage: { zh: '未發現制裁名單匹配項', en: 'No sanctions list matches found' },
      dispositions: alerts.filter(a => !a.isPepish),
    }))
    children.push(...screeningBlock({
      title: `${personIdx}.2  FATF 黑／灰名單  FATF`,
      methodZh: '國籍、證件簽發地、出生地對照 FATF 黑／灰名單',
      methodEn: 'Nationality / place of issue / place of birth vs FATF lists',
      check: scoped.FATF,
      subjectLines: [
        `國籍 Nationality: ${s.nationality || '—'}`,
        `簽發地 Place of issue: ${s.placeOfIssue || '—'}`,
        `出生地 Place of birth: ${s.placeOfBirth || '—'}`,
      ],
      emptyClearMessage: { zh: '未命中 FATF 黑名單或灰名單', en: 'No FATF black or grey list hit' },
    }))
    children.push(...screeningBlock({
      title: `${personIdx}.3  PEP（OpenSanctions）`,
      methodZh: 'OpenSanctions Match API PEP／RCA 比對',
      methodEn: 'OpenSanctions Match API PEP / RCA screening',
      check: scoped.PEP,
      subjectLines: [
        `姓名 Name: ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`,
        `出生日期 DOB: ${fmt(s.dateOfBirth)}`,
        `國籍 Nationality: ${s.nationality || '—'}`,
      ],
      emptyClearMessage: { zh: '未發現 PEP／RCA 命中', en: 'No PEP / RCA matches found' },
      dispositions: alerts.filter(a => a.isPepish),
    }))
    children.push(...screeningBlock({
      title: `${personIdx}.4  負面新聞（人工）  Adverse Media (Manual)`,
      methodZh: '合規人員人工標記 CLEAR 或 HIT（不依賴 Google CSE）',
      methodEn: 'Manual adverse-media review mark CLEAR or HIT (Google CSE not required)',
      check: scoped.ADVERSE_MEDIA,
      subjectLines: [`姓名 Name: ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`],
      emptyClearMessage: {
        zh: '人工審查：未發現相關負面新聞風險',
        en: 'Manual review: no relevant adverse media risk',
      },
      supportingFiles: s.keyPersonId ? (supportingByKp.get(s.keyPersonId) ?? []) : [],
      showSupportingEmpty: true,
    }))
  }

  children.push(...part3Risk(buildRiskRows(riskAnswers)))

  const companyOk = companyCheck?.result === 'CLEAR'
  let allPersonsClear = subjects.length > 0
  const personChecklist: Array<{ label: string; ok: boolean; detail: string }> = [
    { label: 'Company entity screening', ok: companyOk, detail: screeningResultLabel(companyCheck?.result) },
  ]
  for (const s of subjects) {
    const scoped = s.keyPersonId ? scopedByKp.get(s.keyPersonId) : null
    const ok = Boolean(
      scoped
      && scoped.SANCTIONS?.result === 'CLEAR'
      && scoped.FATF?.result === 'CLEAR'
      && scoped.PEP?.result === 'CLEAR'
      && scoped.ADVERSE_MEDIA?.result === 'CLEAR',
    )
    if (!ok) allPersonsClear = false
    personChecklist.push({
      label: [s.nameEn, s.nameZh].filter(Boolean).join(' / '),
      ok,
      detail: ok ? '四步 CLEAR' : (scoped ? '未全部 CLEAR' : '無 KYC 存檔'),
    })
  }
  if (subjects.length === 0) allPersonsClear = false

  const appName = approvedByUser
    ? [approvedByUser.nameEn, approvedByUser.nameZh].filter(Boolean).join(' / ')
    : '—'

  children.push(...part4Conclusion({
    subjectLabel: coDisplay,
    allClear: companyOk && allPersonsClear,
    clearBannerZh: '公司及所列自然人篩查均為 CLEAR — 可作為盡職審查篩查證明',
    clearBannerEn: 'Company and listed natural persons all CLEAR — screening evidence supports CDD file',
    incompleteBannerZh: '篩查尚未全部完成或存在命中 — 請完成四步篩查並決議後再出具最終結論',
    incompleteBannerEn: 'Screening incomplete or hits present — complete four-step screening and disposition before final conclusion',
    riskLevel: ddr?.overallRiskLevel ?? null,
    riskRemark: null,
    approverName: appName,
    approvalDate: ddr?.approvedAt ?? null,
    approvalNote: ddr?.approvalNote ?? null,
    checklist: personChecklist,
  }))

  children.push(...part5Sources(amlSources))
  children.push(...part6Disclaimer())

  return packDoc({
    titleZh: '公司盡職審查報告',
    titleEn: 'Corporate Due Diligence Report',
    children,
  })
}

export async function generatePersonDdrDocx(keyPersonId: string): Promise<Buffer> {
  const person = await prisma.keyPerson.findUniqueOrThrow({
    where: { id: keyPersonId },
    select: {
      id: true,
      kycCode: true,
      titlePrefix: true,
      nameEn: true,
      nameZh: true,
      idType: true,
      idNumber: true,
      placeOfIssue: true,
      placeOfBirth: true,
      idExpiryDate: true,
      dateOfBirth: true,
      nationality: true,
      isUsCitizen: true,
      isPep: true,
      homeAddress: true,
      contactAddress: true,
      mobile: true,
      email: true,
      employmentStatus: true,
      employerName: true,
      position: true,
      sourceOfFunds: true,
      sourcesOfWealth: true,
      annualIncome: true,
      netAssetValue: true,
      declarationDate: true,
      kycStatus: true,
      companyLinks: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          roles: true,
          companyId: true,
          company: { select: { nameEn: true, nameZh: true } },
        },
      },
      kycDocuments: {
        where: { status: { not: 'REJECTED' } },
        select: { id: true, documentType: true, fileName: true, uploadedAt: true },
        orderBy: { uploadedAt: 'desc' },
      },
    },
  })

  const scoped = await loadPersonScopedChecks(keyPersonId)
  const alertDispositions = await loadKeyPersonAlertDispositions(keyPersonId)
  const sanctionsAlerts = alertDispositions.filter(a => !a.isPepish)
  const pepAlerts = alertDispositions.filter(a => a.isPepish)

  const linkedCompanyId = person.companyLinks[0]?.companyId ?? null
  const riskAnswers = linkedCompanyId
    ? await prisma.riskAssessmentAnswer.findMany({
        where: { companyId: linkedCompanyId },
        orderBy: [{ category: 'asc' }, { questionKey: 'asc' }],
      })
    : []

  const companyDdr = linkedCompanyId
    ? await prisma.dueDiligenceReport.findFirst({
        where: { companyId: linkedCompanyId },
        orderBy: { createdAt: 'desc' },
      })
    : null

  const amlSources = await prisma.aMLSource.findMany({
    where: { isActive: true, seqNo: { notIn: [16] } },
    orderBy: { seqNo: 'asc' },
    select: { seqNo: true, nameEn: true, nameZh: true, sourceUrl: true, lastFetched: true },
  })

  const approvedByUser = companyDdr?.approvedById
    ? await prisma.user.findUnique({ where: { id: companyDdr.approvedById }, select: { nameEn: true, nameZh: true } })
    : null

  const today = fmt(new Date())
  const displayName = [person.titlePrefix, person.nameEn].filter(Boolean).join(' ')
  const roles = person.companyLinks[0]?.roles ?? []
  const allFourClear =
    scoped.SANCTIONS?.result === 'CLEAR'
    && scoped.FATF?.result === 'CLEAR'
    && scoped.PEP?.result === 'CLEAR'
    && scoped.ADVERSE_MEDIA?.result === 'CLEAR'

  const idDocs = person.kycDocuments.filter(d =>
    ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION', 'KYC_OTHER'].includes(d.documentType),
  )
  const adverseEvidence = person.kycDocuments.filter(d => d.documentType === 'KYC_ADVERSE_MEDIA')

  const children: Array<Paragraph | Table> = [
    ...coverBlock([
      '個人盡職審查報告',
      'Individual Due Diligence Report',
      displayName,
      person.nameZh || '',
      person.kycCode ? `KYC 編號 Code: ${person.kycCode}` : '',
      `報告日期 Report date: ${today}`,
    ].filter(Boolean)),

    sectionTitle('1. 客戶關鍵信息（篩查相關）  Client Key Information for Screening'),
    kvTable([
      { label: '姓名（英文）\nName (EN)', value: displayName },
      { label: '姓名（中文）\nName (ZH)', value: person.nameZh || '—' },
      { label: 'KYC 編號\nKYC Code', value: person.kycCode || '—' },
      { label: '身份角色\nRole(s)', value: roles.join(', ') || '—' },
      { label: '證件類型\nID Type', value: person.idType || '—' },
      { label: '證件號碼\nID Number', value: person.idNumber || '—' },
      { label: '簽發地\nPlace of Issue', value: person.placeOfIssue || '—' },
      { label: '出生日期\nDate of Birth', value: fmt(person.dateOfBirth) },
      { label: '出生地\nPlace of Birth', value: person.placeOfBirth || '—' },
      { label: '國籍\nNationality', value: person.nationality || '—' },
      { label: '自報 PEP\nSelf-declared PEP', value: person.isPep == null ? '—' : person.isPep ? '是  Yes' : '否  No' },
      { label: '住宅地址\nHome Address', value: person.homeAddress || '—' },
      { label: 'KYC 狀態\nKYC Status', value: person.kycStatus || '—' },
    ]),
  ]

  if (idDocs.length > 0) {
    children.push(subTitle('1.1  已核驗／提交文件  Verified / Submitted Documents'))
    const w = [
      Math.floor(CONTENT_W * 0.08),
      Math.floor(CONTENT_W * 0.28),
      Math.floor(CONTENT_W * 0.42),
    ]
    w.push(CONTENT_W - w[0] - w[1] - w[2])
    children.push(dataTable(
      ['No.', '文件類型\nType', '文件名稱\nFile', '上傳日期\nDate'],
      w,
      idDocs.map((kd, i) => [String(i + 1), kd.documentType, kd.fileName, fmt(kd.uploadedAt)]),
    ))
  }

  children.push(...part13AdverseMedia([{
    subjectLabel: [person.nameEn, person.nameZh].filter(Boolean).join(' / ') || displayName,
    check: scoped.ADVERSE_MEDIA,
    supportingFiles: adverseEvidence.map(d => ({ fileName: d.fileName, uploadedAt: d.uploadedAt })),
  }]))

  children.push(sectionTitle('2. 篩查結果與處置  Screening Results & Disposition'))
  children.push(p(
    '以下按 KYC 四步流程記錄每次篩查結果；若命中則記錄決議與支持文件。\nEach step records outcome, timestamp, and evidence (including clear screens).',
    { size: 16 },
  ))
  children.push(...screeningBlock({
    title: '2.1  制裁名單篩查  Sanctions (AML)',
    methodZh: '系統比對個人姓名與制裁名單（OFAC / UN / HK / EU 等，不含 FATF）',
    methodEn: 'Name screening against sanctions lists (excl. FATF jurisdiction lists)',
    check: scoped.SANCTIONS,
    subjectLines: [
      `姓名 Name: ${[person.nameEn, person.nameZh].filter(Boolean).join(' / ') || '—'}`,
      `出生日期 DOB: ${fmt(person.dateOfBirth)}`,
    ],
    emptyClearMessage: { zh: '未發現制裁名單匹配項', en: 'No sanctions list matches found' },
    dispositions: sanctionsAlerts,
  }))
  children.push(...screeningBlock({
    title: '2.2  FATF 黑／灰名單（司法管轄區）  FATF Black / Grey Lists',
    methodZh: '以國籍、證件簽發地、出生地對照 FATF 黑名單／灰名單（系統內建 JSON）',
    methodEn: 'Jurisdiction screening of nationality, ID/passport place of issue, and place of birth vs FATF lists',
    check: scoped.FATF,
    subjectLines: [
      `國籍 Nationality: ${person.nationality || '—'}`,
      `證件簽發地 Place of issue: ${person.placeOfIssue || '—'}`,
      `出生地 Place of birth: ${person.placeOfBirth || '—'}`,
    ],
    emptyClearMessage: {
      zh: '國籍／簽發地／出生地均未命中 FATF 黑名單或灰名單',
      en: 'Nationality / place of issue / place of birth — no FATF black or grey list hit',
    },
  }))
  children.push(...screeningBlock({
    title: '2.3  政治公眾人物篩查  PEP (OpenSanctions)',
    methodZh: 'OpenSanctions Match API（/match/peps）對姓名等資料進行 PEP／RCA 比對',
    methodEn: 'OpenSanctions Match API (/match/peps) PEP / RCA screening',
    check: scoped.PEP,
    subjectLines: [
      `姓名 Name: ${[person.nameEn, person.nameZh].filter(Boolean).join(' / ') || '—'}`,
      `出生日期 DOB: ${fmt(person.dateOfBirth)}`,
      `國籍 Nationality: ${person.nationality || '—'}`,
    ],
    emptyClearMessage: { zh: '未發現 OpenSanctions PEP／RCA 命中', en: 'No OpenSanctions PEP / RCA matches found' },
    dispositions: pepAlerts,
  }))
  children.push(...screeningBlock({
    title: '2.4  負面新聞／公開媒體（人工）  Adverse Media (Manual)',
    methodZh: '合規人員離線查核公開新聞後於系統標記 CLEAR 或 HIT（不依賴 Google CSE）',
    methodEn: 'Staff manual open-source news review; mark CLEAR or HIT in KYC (Google CSE not required)',
    check: scoped.ADVERSE_MEDIA,
    subjectLines: [
      `姓名 Name: ${[person.nameEn, person.nameZh].filter(Boolean).join(' / ') || '—'}`,
      `通過與否 Pass/Fail: ${adverseMediaPassFail(scoped.ADVERSE_MEDIA?.result).split('\n')[0]}`,
    ],
    emptyClearMessage: {
      zh: '人工審查：未發現相關負面新聞／公開媒體風險',
      en: 'Manual review: no relevant adverse media risk identified',
    },
    supportingFiles: adverseEvidence.map(d => ({ fileName: d.fileName, uploadedAt: d.uploadedAt })),
    showSupportingEmpty: true,
  }))

  if (linkedCompanyId && person.companyLinks[0]?.company) {
    const co = person.companyLinks[0].company
    const coName = [co.nameEn, co.nameZh].filter(Boolean).join(' / ')
    children.push(p(`關聯公司 Linked Company: ${coName}`, { size: 16, spacingBefore: 80 }))
  }
  children.push(...part3Risk(buildRiskRows(riskAnswers)))

  const appName = approvedByUser
    ? [approvedByUser.nameEn, approvedByUser.nameZh].filter(Boolean).join(' / ')
    : '—'

  children.push(...part4Conclusion({
    subjectLabel: [person.nameEn, person.nameZh].filter(Boolean).join(' / ') || displayName,
    allClear: allFourClear,
    clearBannerZh: '四步篩查均為 CLEAR — 可作為個人盡職審查篩查證明',
    clearBannerEn: 'All four screening steps CLEAR — evidence supports individual CDD file',
    incompleteBannerZh: '篩查尚未全部 CLEAR — 請完成四步並決議後再出具最終結論',
    incompleteBannerEn: 'Screening not fully CLEAR — complete four steps and disposition before final conclusion',
    riskLevel: companyDdr?.overallRiskLevel ?? null,
    riskRemark: null,
    approverName: appName,
    approvalDate: companyDdr?.approvedAt ?? null,
    approvalNote: companyDdr?.approvalNote ?? null,
    checklist: [
      { label: '1. AML / Sanctions', ok: scoped.SANCTIONS?.result === 'CLEAR', detail: screeningResultLabel(scoped.SANCTIONS?.result) },
      { label: '2. FATF jurisdictions', ok: scoped.FATF?.result === 'CLEAR', detail: screeningResultLabel(scoped.FATF?.result) },
      { label: '3. PEP (OpenSanctions)', ok: scoped.PEP?.result === 'CLEAR', detail: screeningResultLabel(scoped.PEP?.result) },
      { label: '4. Adverse media (manual)', ok: scoped.ADVERSE_MEDIA?.result === 'CLEAR', detail: screeningResultLabel(scoped.ADVERSE_MEDIA?.result) },
    ],
  }))

  children.push(...part5Sources(amlSources))
  children.push(...part6Disclaimer())

  return packDoc({
    titleZh: '個人盡職審查報告',
    titleEn: 'Individual Due Diligence Report',
    children,
  })
}
