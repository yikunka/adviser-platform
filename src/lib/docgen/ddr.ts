import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import type { Font, Fontkit } from 'pdf-lib/es/types/fontkit'
import * as pdfLibFontkit from '@pdf-lib/fontkit'
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

type RiskTemplateItem = {
  category: string
  question: string
}

// ── Font loading ──────────────────────────────────────────────────────────────
type FontkitFontWithNames = Font & {
  familyName?: string
  fullName?: string
  postscriptName?: string
}

function fontFaceName(font: FontkitFontWithNames) {
  return [font.postscriptName, font.fullName, font.familyName].filter(Boolean).join(' ')
}

function preferredCollectionFont(fonts: Font[]): Font {
  const namedFonts = fonts as FontkitFontWithNames[]
  const requestedIndex = Number.parseInt(process.env.DDR_PDF_FONT_FACE_INDEX ?? '', 10)
  if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < namedFonts.length) {
    return namedFonts[requestedIndex]
  }

  const requestedFace = process.env.DDR_PDF_FONT_FACE?.trim().toLowerCase()
  if (requestedFace) {
    const requested = namedFonts.find(font => fontFaceName(font).toLowerCase().includes(requestedFace))
    if (requested) return requested
  }

  // Noto/Source Han TTC files often list JP first. Prefer HK/TC/SC faces so
  // Chinese glyph shapes and report numbering render as expected.
  const preferredPatterns = [
    /cjkhk/i,
    /\bhk\b/i,
    /cjk[-_\s]?tc/i,
    /\btc\b/i,
    /traditional/i,
    /cjk[-_\s]?sc/i,
    /\bsc\b/i,
    /simplified/i,
    /sourcehan.*(hk|tc|sc)/i,
    /noto.*(hk|tc|sc)/i,
  ]
  for (const pattern of preferredPatterns) {
    const font = namedFonts.find(item => pattern.test(fontFaceName(item)))
    if (font) return font
  }
  return namedFonts[0]
}

function loadFontkitBridge(): { fontkit: Fontkit; subset: boolean } | null {
  // Use the statically imported @pdf-lib/fontkit (avoids eval('require') which
  // does not work in Next.js production webpack bundles).
  const fk = (pdfLibFontkit as unknown as { default?: Fontkit } & Fontkit)
  const rawFontkit = (fk.default ?? fk) as Fontkit
  if (!rawFontkit || typeof rawFontkit.create !== 'function') return null
  // Wrap create() so TTC collections yield a single Chinese-capable font face
  // (which has layout()). Choosing the first face commonly selects JP glyphs.
  // Keep subsetting enabled; embedding a full CJK font makes each DDR ~15MB+.
  const fontkit: Fontkit = {
    create(data: Uint8Array) {
      const result = rawFontkit.create(data) as Font & { fonts?: Font[] }
      return (result.fonts?.length ? preferredCollectionFont(result.fonts) : result) as Font
    },
  }
  return { fontkit, subset: true }
}

async function firstExistingFontPath(): Promise<string | null> {
  const candidates = [
    process.env.DDR_PDF_FONT_PATH,
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/fonts/NotoSansCJK-Regular.otf'),
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/fonts/NotoSansCJKsc-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/arphic/uming.ttc',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/STHeiti Medium.ttc',
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    try { await fs.access(p); return p } catch { /* try next */ }
  }
  return null
}

async function loadReportFonts(doc: PDFDocument): Promise<ReportFonts> {
  const fontPath = await firstExistingFontPath()
  const bridge = fontPath ? loadFontkitBridge() : null
  if (fontPath && bridge) {
    doc.registerFontkit(bridge.fontkit)
    const bytes = await fs.readFile(fontPath)
    const regular = await doc.embedFont(bytes, { subset: bridge.subset })
    return { regular, bold: regular, supportsUnicode: true }
  }
  return {
    bold:    await doc.embedFont(StandardFonts.HelveticaBold),
    regular: await doc.embedFont(StandardFonts.Helvetica),
    supportsUnicode: false,
  }
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

const DEFAULT_RISK_ITEMS: RiskTemplateItem[] = [
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與被認定為缺乏足夠反洗錢(AML)或反恐融資(CTF)監管框架的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that has been designated as having inadequate anti-money laundering (AML) or counter-terrorism financing (CTF) regulatory frameworks?',
  },
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與被正式認定為存在較高貪腐水平或重大犯罪活動的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that has been officially recognized as experiencing elevated levels of corruption or substantial criminal activities?',
  },
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與受到國際監管機構(包括但不限於聯合國(UN))制裁的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that is subject to sanctions imposed by international regulatory authorities, including but not limited to the United Nations (UN)?',
  },
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與被認定為向恐怖活動提供財政支持或在其主權邊界內庇護指定恐怖組織的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that has been identified as providing financial support to terrorist activities or harboring designated terrorist organizations within its sovereign borders?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否使用代名董事或股東？\nDoes the Client employ nominee director(s) or shareholder(s) in its corporate governance structure?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否發行不記名股票？\nDoes the Client issue bearer shares as part of its corporate securities framework?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶的所有權結構是否看似異常或過於複雜，與其業務性質不符？\nDoes the ownership structure of the Client exhibit unusual characteristics or excessive complexity disproportionate to the nature of its business operations?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '擬議的實益擁有人/董事/合夥人/股東是否有涉及欺詐或不誠實的前科？\nDo the proposed beneficial owners/directors/partners/shareholders possess prior criminal convictions related to fraudulent activities or acts of dishonesty?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '任何實益擁有人/董事/合夥人/股東是否為外國政治公眾人物(PEPs)？\nAre any of the beneficial owners/directors/partners/shareholders classified as foreign Politically Exposed Persons (PEPs)?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '任何實益擁有人/董事/合夥人/股東是否為外國政治公眾人物的親屬或密切關係人？\nAre any of the beneficial owners/directors/partners/shareholders identified as relatives or close associates of foreign Politically Exposed Persons (PEPs)?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶的股東和/或董事是否經常變更，且這些變更無法獲得合理解釋？\nDoes the Client demonstrate a pattern of frequent and unexplained changes to its shareholders and/or directors without adequate documentation or justification?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否涉及可能被犯罪分子或恐怖組織濫用於洗錢/恐怖融資的業務（高風險業務）？\nIs the Client engaged in business activities that present elevated risks for exploitation by criminal elements or terrorist organizations for money laundering or terrorist financing purposes?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否涉及現金密集型業務？\nIs the Client operating within sectors characterized by high volumes of cash transactions?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '從客戶處獲取客戶本身及實益擁有人的身份證明是否存在困難；且所提供的文件是否不令人滿意？\nHave there been difficulties in obtaining satisfactory identification documentation from the Client pertaining to both the Client entity and its beneficial owner(s)?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否過於神秘或迴避問題（例如關於實益擁有人或資金來源的問題）？\nDoes the Client exhibit undue secrecy or evasiveness regarding disclosure of beneficial ownership information or sources of funding?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否在沒有充分理由的情況下積極避免個人接觸？\nDoes the Client demonstrate a pattern of avoiding direct personal interaction without providing reasonable justification?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否頻繁且無合理解釋地更換專業顧問或管理層成員？\nDoes the Client experience recurring and unexplained modifications to its professional advisory relationships or management personnel?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶的員工數量或結構是否與業務規模或性質不符（例如，考慮到所使用的員工數量和資產，業務營業額不合理地高）？\nDoes the Client maintain employee staffing levels or organizational structures that appear inconsistent with the scale or nature of its business activities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否曾指示執行交易（可能包括現金交易）且要求匿名進行？\nHas the Client issued instructions to execute a transaction (potentially including cash transactions) with requirements for anonymity?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '這是否為一個要求走捷徑並對交易完成速度要求不合理的客戶？\nDoes the Client demonstrate a pattern of requesting expedited processing or procedural shortcuts without providing adequate justification for the urgency in transaction completion?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否頻繁地向相同收款人進行未說明的現金交易？\nDoes the Client exhibit a pattern of conducting recurring unrecorded cash transactions with consistent recipient entities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在異常的交易模式，這些交易沒有明顯的經濟目的，或有大額現金支付，而這些支付通常應通過其他支付方式進行（如支票、銀行匯票等）？\nAre there transaction patterns evident that lack clear economic rationale, or instances of substantial cash disbursements where alternative payment methodologies would typically be utilized?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在來自未知或無關聯第三方對客戶提供的服務和/或交易的未說明付款？\nDoes the Client receive unsubstantiated payments from unidentified or unaffiliated third parties in connection with services rendered or transactions facilitated?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否指示成立空殼公司，並設置代名股東和/或董事？\nHas the Client requested assistance in establishing shell corporate entities utilizing nominee shareholders and/or directors?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否購買沒有明顯商業目的的公司或商業實體？\nDoes the Client engage in the acquisition of corporate entities or business operations that demonstrate no evident commercial or operational purpose?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在未經任何面對面會議就建立的業務關係或執行的交易？\nHave business relationships been established or transactions been executed without any in-person verification or physical meetings?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '在與客戶的業務關係過程中，所預期的服務和/或交易的類型、數量或頻率是否存在差異？\nIs there a notable discrepancy between the anticipated and actual patterns of service utilization or transaction characteristics within the established business relationship?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否進行實際現金（以紙幣和硬幣形式）支付？\nHas the Client conducted financial transactions using physical currency (notes and coins)?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶在購買房地產時是否提供與其社會經濟狀況不符的不成比例的私人資金？\nHas the Client deployed private funding for real estate acquisitions in amounts disproportionate to their documented socio-economic profile?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否為購買土地權益進行大額現金支付，而該土地的價值遠低於支付金額，或資金來源方式不尋常？\nHas the Client utilized substantial cash payments for land interest acquisitions where the property valuation appears significantly lower than the investment, or where funding mechanisms demonstrate irregularities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '相對於具有類似背景的客戶所能合理預期的情況，客戶是否擁有異常高水平的資產或異常大額的交易？\nDoes the Client maintain asset holdings or execute transactions of a magnitude that significantly exceeds reasonable expectations for clients with comparable financial profiles?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否在異常短的時間內進行房地產在各方之間的轉讓？\nHas the Client participated in real estate transfers between parties within an atypically abbreviated timeframe?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否有要求支付給第三方但沒有實質理由或相應交易的請求？\nHas the Client submitted requests for third-party payments without providing substantiating documentation or corresponding transaction justification?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否在沒有合法或經濟理由的情況下指示建立複雜的所有權結構？\nHas the Client requested the implementation of elaborate ownership structures without demonstrable legitimate business purposes or economic rationale?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否有被放棄的交易，且客戶對費用水平沒有關注？\nAre there instances of transaction abandonment without apparent concern regarding associated fee obligations?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在任何可避免的虧損交易？\nDoes the Client engage in transactions that result in financial losses that could reasonably have been avoided?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否缺乏能支持客戶故事、過往交易或公司活動的文件？\nIs there a deficiency in documentary evidence supporting the Client\'s representations, historical transactions, or corporate activities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否有任何無法解釋的明示信託使用？\nDoes the Client utilize express trust arrangements without adequate explanation?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否通過使用授權委託書、混合董事會和代表處的方式，給予未經解釋的授權委託？\nHas the Client implemented authority delegation mechanisms through powers of attorney, diversified board compositions, or representative offices without sufficient justification?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '在明示信託的情況下，委託人與具有既得權利的受益人、其他受益人以及作為權力對象的人之間是否存在任何無法解釋的關係？\nRegarding express trust arrangements, are there unexplained relationships between settlors and beneficiaries with vested rights, other beneficiaries, or individuals designated as objects of a power?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '在明示信託的情況下，受益人類別以及願望表達中的類別性質是否存在任何無法解釋的情況（在需要解釋的情況下）？\nIn the context of express trusts, are there classifications of beneficiaries or subcategories within wish expressions that lack necessary explanations where such clarification would be warranted?',
  },
]

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
    select: { seqNo: true, nameEn: true, nameZh: true, lastFetched: true },
  })

  const approvedByUser = ddr?.approvedById
    ? await prisma.user.findUnique({ where: { id: ddr.approvedById }, select: { nameEn: true, nameZh: true } })
    : null
  const recommendedByUser = ddr?.recommendedById
    ? await prisma.user.findUnique({ where: { id: ddr.recommendedById }, select: { nameEn: true, nameZh: true } })
    : null

  // Preload scoped checks for persons with KYC ids
  const scopedByKp = new Map<string, Awaited<ReturnType<typeof loadPersonScopedChecks>>>()
  await Promise.all(
    subjects
      .filter(s => s.keyPersonId)
      .map(async s => {
        const scoped = await loadPersonScopedChecks(s.keyPersonId!)
        scopedByKp.set(s.keyPersonId!, scoped)
      }),
  )

  const companyCheckRaw = company.amlChecks[0] ?? null
  const companyCheck: PersonScopedCheck | null = companyCheckRaw
    ? {
        result: companyCheckRaw.result,
        checkedAt: companyCheckRaw.checkedAt,
        matches: companyCheckRaw.matches,
        triggeredBy: companyCheckRaw.triggeredBy,
      }
    : null

  const doc = await PDFDocument.create()
  const fonts = await loadReportFonts(doc)
  if (!fonts.supportsUnicode) {
    throw new Error(
      'DDR generation requires a CJK font because the report template contains Chinese text. '
      + 'On Linux: apt-get install fonts-noto-cjk  OR  yum install google-noto-cjk-fonts. '
      + 'Or place a font at assets/fonts/NotoSansCJK-Regular.otf. '
      + 'Or set the DDR_PDF_FONT_PATH environment variable.',
    )
  }

  const ps: PageState = {
    page: doc.addPage([W, H]),
    y: H - MARGIN,
    bold: fonts.bold,
    regular: fonts.regular,
  }

  const fmt = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-HK') : '—'
  const today = fmt(new Date())
  const coDisplay = [company.nameEn, company.nameZh].filter(Boolean).join(' / ')

  // Cover — same visual language as individual DDR
  ps.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })
  ps.page.drawRectangle({
    x: 42.52, y: 328.03, width: 510.24, height: 457.17,
    color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 1.5,
  })
  ps.page.drawRectangle({
    x: 72.52, y: 566.8, width: 450.24, height: 70.5,
    color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 0.75,
  })

  drawText(ps.page, '公司盡職審查報告', { x: 168, y: 694, size: 24, font: ps.bold, color: PRIMARY })
  drawText(ps.page, 'Corporate Due Diligence Report', { x: 132, y: 661, size: 18, font: ps.bold, color: PRIMARY })
  drawText(ps.page, '公司盡職審查報告', { x: 220, y: 607, size: 14, font: ps.bold, color: PRIMARY })
  drawText(ps.page, 'Corporate Due Diligence Report', { x: 178, y: 586, size: 13, font: ps.regular, color: PRIMARY })

  ps.page.drawLine({ start: { x: 72.52, y: 542 }, end: { x: 522.76, y: 542 }, thickness: 1.5, color: ACCENT })

  drawText(ps.page, company.nameEn, { x: 72.52, y: 512, size: 12, font: ps.bold, color: BLACK })
  if (company.nameZh) {
    drawText(ps.page, company.nameZh, { x: 72.52, y: 492, size: 12, font: ps.bold, color: BLACK })
  }
  if (company.companyNumber) {
    drawText(ps.page, `公司編號 Company No.: ${company.companyNumber}`, {
      x: 72.52, y: 472, size: 9, font: ps.regular, color: GRAY,
    })
  }
  drawText(ps.page, `報告日期 Report date: ${today}`, { x: 72.52, y: 452, size: 9, font: ps.regular, color: GRAY })
  drawText(ps.page, '本報告記錄公司身份、股權穿透（有效權益>25%）、董事／重要控制人及篩查證明。', {
    x: 72.52, y: 420, size: 8.5, font: ps.regular, color: GRAY,
  })
  drawText(ps.page, 'Identity, ownership look-through (>25% effective), directors / SC, and screening evidence.', {
    x: 72.52, y: 404, size: 8, font: ps.regular, color: GRAY,
  })

  newPage(doc, ps)
  ps.y = H - MARGIN

  // 1. Company identity
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '1. 客戶身份與核驗  Customer Identity & Verification')

  const identityRows: Array<{ label: string; value: string }> = [
    { label: '公司名稱（英文）\nName (EN)', value: company.nameEn },
    { label: '公司名稱（中文）\nName (ZH)', value: company.nameZh || '—' },
    { label: '公司編號\nCompany No.', value: company.companyNumber || '—' },
    { label: '商業登記號\nBR No.', value: company.businessRegNumber || '—' },
    { label: '成立日期\nIncorporation', value: fmt(company.dateOfIncorporation) },
    { label: '註冊地址\nRegistered Address', value: company.registeredAddress || '—' },
    { label: '業務性質\nBusiness Nature', value: company.businessNature || '—' },
    { label: '公司狀態\nStatus', value: company.status || '—' },
  ]
  for (const row of identityRows) {
    await ensureSpace(ps, doc, ROW_H + 2)
    drawInfoBox(ps, [{ label: row.label, value: row.value }])
  }
  ps.y -= 8

  // 1.1 Ownership structure
  await ensureSpace(ps, doc, 40)
  subHeader(ps, '1.1  股權結構（穿透）  Ownership Structure (Look-through)')
  drawText(ps.page, '實益擁有人門檻：穿透後有效權益超過 25%（AMLO / CR TCSP Guideline）。', {
    x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY,
  })
  ps.y -= 12
  drawText(ps.page, 'UBO threshold: more than 25% effective ownership after look-through.', {
    x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY,
  })
  ps.y -= 14

  if (!structure) {
    drawText(ps.page, '未能載入股權結構。  Ownership structure unavailable.', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 14
  } else {
    const lines: string[] = []
    const walk = (node: OwnershipNode, depth: number) => {
      const indent = '  '.repeat(depth)
      const pct = node.ownershipPercent != null ? ` ${node.ownershipPercent.toFixed(2)}%` : ''
      const tag = node.type === 'COMPANY' ? '[Co]' : '[Person]'
      const circ = node.circular ? ' (circular)' : ''
      lines.push(`${indent}${tag} ${[node.nameEn, node.nameZh].filter(Boolean).join(' / ')}${pct}${circ}`)
      for (const child of node.children) walk(child, depth + 1)
    }
    walk(structure, 0)
    for (const line of lines.slice(0, 80)) {
      await ensureSpace(ps, doc, 12)
      for (const wrapped of wrapText(line, ps.regular, 8, CW - 8)) {
        drawText(ps.page, wrapped, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: BLACK })
        ps.y -= 10
      }
    }
    if (lines.length > 80) {
      drawText(ps.page, `… and ${lines.length - 80} more node(s)`, {
        x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY,
      })
      ps.y -= 12
    }
  }
  ps.y -= 8

  // 1.2 Screening subjects table
  await ensureSpace(ps, doc, 40)
  subHeader(ps, '1.2  篩查對象  Screening Subjects')
  drawText(ps.page, '包括：有效權益>25% 之實益擁有人；全體自然人董事；全體自然人重要控制人。', {
    x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY,
  })
  ps.y -= 12

  if (subjects.length === 0) {
    drawBanner(ps, '未識別到需篩查之自然人對象', 'No natural-person screening subjects identified', false)
  } else {
    const COL_NO = 28
    const COL_NAME = Math.floor((CW - COL_NO) * 0.32)
    const COL_ROLE = Math.floor((CW - COL_NO) * 0.48)
    const COL_PCT = CW - COL_NO - COL_NAME - COL_ROLE
    drawTableHeader(ps, [
      { label: 'No.', width: COL_NO, center: true },
      { label: '姓名\nName', width: COL_NAME },
      { label: '角色\nRoles', width: COL_ROLE },
      { label: '有效權益\nEffective %', width: COL_PCT, center: true },
    ], 28)
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i]
      await ensureSpace(ps, doc, ROW_H + 4)
      drawTableRow(ps, [
        { text: String(i + 1), width: COL_NO, center: true },
        { text: [s.nameEn, s.nameZh].filter(Boolean).join(' / '), width: COL_NAME },
        { text: s.roles.join('; '), width: COL_ROLE },
        {
          text: s.effectivePercent != null ? `${s.effectivePercent.toFixed(2)}%` : '—',
          width: COL_PCT,
          center: true,
        },
      ])
    }
  }
  ps.y -= 10

  // 2. Screening evidence
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '2. AML/CFT 篩查證明  Screening Evidence')

  await drawScreeningProofBlock(ps, doc, {
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
  })

  let personIdx = 0
  for (const s of subjects) {
    personIdx += 1
    await ensureSpace(ps, doc, 40)
    subHeader(ps, `2.${personIdx}  ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`)
    drawText(ps.page, `角色 Roles: ${s.roles.join('; ')}`, {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 12
    if (s.effectivePercent != null) {
      drawText(ps.page, `穿透後有效權益 Effective ownership: ${s.effectivePercent.toFixed(2)}%`, {
        x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
      })
      ps.y -= 12
    }

    const scoped = s.keyPersonId ? scopedByKp.get(s.keyPersonId) : null
    if (!scoped) {
      drawBanner(
        ps,
        '尚無個人四步 KYC 篩查存檔 — 請完成個人 KYC 四步篩查',
        'No four-step KYC screening on file — complete individual KYC screening',
        false,
      )
      drawInfoBox(ps, [
        { label: '證件\nID', value: [s.idType, s.idNumber].filter(Boolean).join(': ') || '—' },
        { label: '國籍\nNationality', value: s.nationality || '—' },
        { label: '出生日期\nDOB', value: fmt(s.dateOfBirth) },
        { label: '簽發地／出生地\nIssue / Birth', value: [s.placeOfIssue, s.placeOfBirth].filter(Boolean).join(' / ') || '—' },
      ])
      ps.y -= 8
      continue
    }

    await drawScreeningProofBlock(ps, doc, {
      title: `${personIdx}.1  制裁名單  Sanctions (AML)`,
      methodZh: '系統比對個人姓名與制裁名單（不含 FATF）',
      methodEn: 'Name screening against sanctions lists (excl. FATF)',
      check: scoped.SANCTIONS,
      subjectLines: [
        `姓名 Name: ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`,
        `出生日期 DOB: ${fmt(s.dateOfBirth)}`,
      ],
      emptyClearMessage: {
        zh: '未發現制裁名單匹配項',
        en: 'No sanctions list matches found',
      },
    })

    await drawScreeningProofBlock(ps, doc, {
      title: `${personIdx}.2  FATF 黑／灰名單  FATF`,
      methodZh: '國籍、證件簽發地、出生地對照 FATF 黑／灰名單',
      methodEn: 'Nationality / place of issue / place of birth vs FATF lists',
      check: scoped.FATF,
      subjectLines: [
        `國籍 Nationality: ${s.nationality || '—'}`,
        `簽發地 Place of issue: ${s.placeOfIssue || '—'}`,
        `出生地 Place of birth: ${s.placeOfBirth || '—'}`,
      ],
      emptyClearMessage: {
        zh: '未命中 FATF 黑名單或灰名單',
        en: 'No FATF black or grey list hit',
      },
    })

    await drawScreeningProofBlock(ps, doc, {
      title: `${personIdx}.3  PEP（OpenSanctions）`,
      methodZh: 'OpenSanctions Match API PEP／RCA 比對',
      methodEn: 'OpenSanctions Match API PEP / RCA screening',
      check: scoped.PEP,
      subjectLines: [
        `姓名 Name: ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`,
        `出生日期 DOB: ${fmt(s.dateOfBirth)}`,
        `國籍 Nationality: ${s.nationality || '—'}`,
      ],
      emptyClearMessage: {
        zh: '未發現 PEP／RCA 命中',
        en: 'No PEP / RCA matches found',
      },
    })

    await drawScreeningProofBlock(ps, doc, {
      title: `${personIdx}.4  負面新聞（人工）  Adverse Media (Manual)`,
      methodZh: '合規人員人工標記 CLEAR 或 HIT（不依賴 Google CSE）',
      methodEn: 'Manual adverse-media review mark CLEAR or HIT (Google CSE not required)',
      check: scoped.ADVERSE_MEDIA,
      subjectLines: [
        `姓名 Name: ${[s.nameEn, s.nameZh].filter(Boolean).join(' / ')}`,
      ],
      emptyClearMessage: {
        zh: '人工審查：未發現相關負面新聞風險',
        en: 'Manual review: no relevant adverse media risk',
      },
    })
  }

  // 3. Risk assessment
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '3. 風險評估  Risk Assessment')

  await ensureSpace(ps, doc, 40)
  subHeader(ps, '3.1  評估項目  Assessment Items')
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
  await drawAssessmentTable(ps, doc, [...defaults, ...extras])

  const riskLevel = ddr?.overallRiskLevel ?? null
  const riskText = riskLabel(riskLevel)
  const riskCol = riskColor(riskLevel)
  const recName = recommendedByUser
    ? [recommendedByUser.nameEn, recommendedByUser.nameZh].filter(Boolean).join(' / ')
    : '—'
  const appName = approvedByUser
    ? [approvedByUser.nameEn, approvedByUser.nameZh].filter(Boolean).join(' / ')
    : '—'
  const appStatus = ddr?.approvalStatus === true ? '已批准  Approved'
    : ddr?.approvalStatus === false ? '未批准  Not approved'
      : '待批  Pending'

  await drawApprovalBox(ps, doc, '3.2  評估風險  Risk Summary', [
    { label: '整體風險等級\nOverall Risk Level', value: riskText, valueColor: riskCol },
    { label: '風險備註\nRisk Remark', value: '無備註  No Remark' },
    { label: '風險評估人員簽署\nRisk Assessor Signature', value: '', tall: true },
  ])

  await drawApprovalBox(ps, doc, '3.3  推薦  Recommendation', [
    { label: '推薦狀態\nRecommendation Status', value: recommendationLabel(ddr?.recommendation) },
    { label: '推薦備註\nRecommendation Remark', value: ddr?.recommendationNote || '' },
    { label: '推薦日期\nRecommendation Date', value: fmt(ddr?.recommendedAt ?? ddr?.reportDate) },
    { label: '推薦人員\nRecommending Officer', value: recName },
    { label: '推薦人員簽署\nRecommending Officer Signature', value: '', tall: true },
  ])

  await drawApprovalBox(ps, doc, '3.4  批准  Approval', [
    {
      label: '批准狀態\nApproval Status',
      value: appStatus,
      valueColor: ddr?.approvalStatus === true ? GREEN_TEXT : ddr?.approvalStatus === false ? RED : GRAY,
    },
    { label: '批准備註\nApproval Remark', value: ddr?.approvalNote || '' },
    { label: '批准日期\nApproval Date', value: fmt(ddr?.approvedAt) },
    { label: '批准人員\nApproval Officer', value: appName },
    { label: '批准人員簽署\nApproval Officer Signature', value: '', tall: true },
  ])

  // 4. Conclusion
  await ensureSpace(ps, doc, 100)
  sectionHeader(ps, doc, '4. 調查結論  Conclusion')

  await ensureSpace(ps, doc, 40)
  subHeader(ps, '4.1  篩查完成度  Screening Completeness')

  const companyOk = companyCheck?.result === 'CLEAR'
  drawText(ps.page, `${companyOk ? '✓' : '○'}  Company entity screening`, {
    x: MARGIN + 8, y: ps.y, size: 9, font: ps.bold, color: companyOk ? GREEN_TEXT : GRAY,
  })
  drawText(ps.page, screeningResultLabel(companyCheck?.result), {
    x: MARGIN + 240, y: ps.y, size: 9, font: ps.regular, color: screeningResultColor(companyCheck?.result),
  })
  ps.y -= 16

  let allPersonsClear = subjects.length > 0
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
    const label = [s.nameEn, s.nameZh].filter(Boolean).join(' / ')
    await ensureSpace(ps, doc, 16)
    drawText(ps.page, `${ok ? '✓' : '○'}  ${label}`, {
      x: MARGIN + 8, y: ps.y, size: 8.5, font: ps.bold, color: ok ? GREEN_TEXT : GRAY,
    })
    drawText(ps.page, ok ? '四步 CLEAR' : (scoped ? '未全部 CLEAR' : '無 KYC 存檔'), {
      x: MARGIN + 280, y: ps.y, size: 8.5, font: ps.regular, color: ok ? GREEN_TEXT : ORANGE,
    })
    ps.y -= 14
  }
  ps.y -= 6

  if (companyOk && allPersonsClear) {
    drawBanner(
      ps,
      '公司及所列自然人篩查均為 CLEAR — 可作為盡職審查篩查證明',
      'Company and listed natural persons all CLEAR — screening evidence supports CDD file',
      true,
    )
  } else {
    drawBanner(
      ps,
      '篩查尚未全部完成或存在命中 — 請完成四步篩查後再出具最終結論',
      'Screening incomplete or hits present — complete four-step screening before final conclusion',
      false,
    )
  }

  if (ddr) {
    ps.y -= 6
    const rBg = riskCol === GREEN_TEXT ? GREEN_BG : riskCol === RED ? RED_BG : rgb(0.99, 0.96, 0.9)
    ps.page.drawRectangle({ x: MARGIN + 4, y: ps.y - 24, width: CW - 8, height: 24, color: rBg })
    drawText(ps.page, '整體風險級別  Overall Risk Level:', {
      x: MARGIN + 10, y: ps.y - 16, size: 10, font: ps.bold, color: BLACK,
    })
    drawText(ps.page, riskText, { x: MARGIN + 220, y: ps.y - 16, size: 10, font: ps.bold, color: riskCol })
    ps.y -= 30
    if (ddr.recommendation) field(ps, '建議  Recommendation', ddr.recommendation)
    if (ddr.recommendationNote) field(ps, '建議備註  Recommendation Note', ddr.recommendationNote)
    if (ddr.approvalStatus !== null && ddr.approvalStatus !== undefined) {
      field(ps, '審批狀態  Approval Status', ddr.approvalStatus ? 'APPROVED 已批准' : 'NOT APPROVED 未批准')
    }
    if (ddr.approvalNote) field(ps, '審批備註  Approval Note', ddr.approvalNote)
  }

  // 5. Sources
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '5. 資料來源與說明  Data Sources and Notes')
  ps.y -= 4
  for (const line of wrapText(
    '制裁名單來源如下。FATF 使用系統內建黑／灰名單 JSON。個人 PEP 使用 OpenSanctions；負面新聞為人工審查。實益擁有人按穿透後有效權益超過 25% 識別（AMLO）。',
    ps.regular, 8.5, CW - 8,
  )) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: BLACK })
    ps.y -= 12
  }
  ps.y -= 6

  if (amlSources.length === 0) {
    drawText(ps.page, '暫無資料來源記錄。  No data source records available.', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 14
  } else {
    const COL_SEQ = 36
    const COL_ZH = Math.floor((CW - COL_SEQ) * 0.38)
    const COL_EN = Math.floor((CW - COL_SEQ) * 0.38)
    const COL_FETCH = CW - COL_SEQ - COL_ZH - COL_EN
    drawTableHeader(ps, [
      { label: '序號\nNo.', width: COL_SEQ, center: true },
      { label: '名稱（中文）\nName (ZH)', width: COL_ZH },
      { label: '名稱（英文）\nName (EN)', width: COL_EN },
      { label: '最後更新\nLast Updated', width: COL_FETCH, center: true },
    ], 28)
    for (const src of amlSources) {
      await ensureSpace(ps, doc, ROW_H + 2)
      drawTableRow(ps, [
        { text: String(src.seqNo), width: COL_SEQ, center: true },
        { text: src.nameZh, width: COL_ZH },
        { text: src.nameEn, width: COL_EN },
        { text: fmt(src.lastFetched), width: COL_FETCH, center: true },
      ])
    }
  }

  ps.y -= 10
  for (const line of wrapText(
    '說明：本報告第 2 節以系統存檔之篩查結果為準，生成時不重新自動篩查。董事與重要控制人不論持股一律納入；實益擁有人以穿透後有效權益>25% 為準。',
    ps.regular, 8, CW - 8,
  )) {
    await ensureSpace(ps, doc, 11)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
  ps.y -= 10

  await ensureSpace(ps, doc, 80)
  sectionHeader(ps, doc, '6. 免責聲明  Disclaimer')
  const disclaimerZH =
    '本報告由 6AM Advisory (Hong Kong) Limited 為內部合規目的而製備，所載資料屬機密性質，'
    + '受香港《個人資料（私隱）條例》等適用數據保護法律規管。未經事先書面同意，不得向任何第三方披露本報告。'
  const disclaimerEN =
    'This report is prepared by 6AM Advisory (Hong Kong) Limited for internal compliance purposes only. '
    + 'The information contained herein is confidential and subject to applicable data protection laws including '
    + 'the Hong Kong Personal Data (Privacy) Ordinance. This report shall not be disclosed to any third party '
    + 'without prior written consent.'
  ps.y -= 4
  for (const line of wrapText(disclaimerZH, ps.regular, 8, CW - 8)) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
  ps.y -= 4
  for (const line of wrapText(disclaimerEN, ps.regular, 8, CW - 8)) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 11
  }

  return Buffer.from(await doc.save())
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

type PersonScopedCheck = {
  result: string
  checkedAt: Date
  matches: unknown
  triggeredBy: { nameEn: string | null; nameZh: string | null } | null
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

/** Draw one audit-ready screening proof block (result + timestamp + details). */
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
  },
) {
  await ensureSpace(ps, doc, 80)
  subHeader(ps, opts.title)

  const check = opts.check
  const isClear = check?.result === 'CLEAR'
  const isGood = Boolean(check && isClear)

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

  if (check?.matches && typeof check.matches === 'object' && !Array.isArray(check.matches)) {
    const meta = check.matches as { manual?: boolean; notes?: string | null }
    if (meta.manual) {
      await ensureSpace(ps, doc, 28)
      drawText(ps.page, '人工審查備註  Manual review notes:', {
        x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.bold, color: BLACK,
      })
      ps.y -= 12
      for (const line of wrapText(meta.notes?.trim() || '（無備註  No notes）', ps.regular, 8.5, CW - 16)) {
        await ensureSpace(ps, doc, 12)
        drawText(ps.page, line, { x: MARGIN + 8, y: ps.y, size: 8.5, font: ps.regular, color: GRAY })
        ps.y -= 11
      }
      ps.y -= 4
    }
  }

  const matchRows = parseMatchRows(check?.matches)
  const isHit = Boolean(check && check.result !== 'CLEAR')
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

  ps.y -= 8
}

export async function generatePersonDDR(keyPersonId: string): Promise<Buffer> {
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
    select: { seqNo: true, nameEn: true, nameZh: true, lastFetched: true },
  })

  const approvedByUser = companyDdr?.approvedById
    ? await prisma.user.findUnique({ where: { id: companyDdr.approvedById }, select: { nameEn: true, nameZh: true } })
    : null
  const recommendedByUser = companyDdr?.recommendedById
    ? await prisma.user.findUnique({ where: { id: companyDdr.recommendedById }, select: { nameEn: true, nameZh: true } })
    : null

  const doc = await PDFDocument.create()
  const fonts = await loadReportFonts(doc)

  if (!fonts.supportsUnicode) {
    throw new Error(
      'DDR generation requires a CJK font because the report template contains Chinese text. '
      + 'On Linux: apt-get install fonts-noto-cjk  OR  yum install google-noto-cjk-fonts. '
      + 'Or place a font at assets/fonts/NotoSansCJK-Regular.otf. '
      + 'Or set the DDR_PDF_FONT_PATH environment variable.',
    )
  }

  const ps: PageState = {
    page: doc.addPage([W, H]),
    y: H - MARGIN,
    bold: fonts.bold,
    regular: fonts.regular,
  }

  const fmt = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-HK') : '—'
  const today = fmt(new Date())
  const displayName = [person.titlePrefix, person.nameEn].filter(Boolean).join(' ')
  const roles = person.companyLinks[0]?.roles ?? []

  const allFourClear =
    scoped.SANCTIONS?.result === 'CLEAR'
    && scoped.FATF?.result === 'CLEAR'
    && scoped.PEP?.result === 'CLEAR'
    && scoped.ADVERSE_MEDIA?.result === 'CLEAR'

  // Cover
  ps.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) })
  ps.page.drawRectangle({
    x: 42.52, y: 328.03, width: 510.24, height: 457.17,
    color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 1.5,
  })
  ps.page.drawRectangle({
    x: 72.52, y: 566.8, width: 450.24, height: 70.5,
    color: rgb(1, 1, 1), borderColor: ACCENT, borderWidth: 0.75,
  })

  drawText(ps.page, '個人盡職審查報告', { x: 180, y: 694, size: 24, font: ps.bold, color: PRIMARY })
  drawText(ps.page, 'Individual Due Diligence Report', { x: 140, y: 661, size: 19, font: ps.bold, color: PRIMARY })
  drawText(ps.page, '個人盡職審查報告', { x: 232, y: 607, size: 14, font: ps.bold, color: PRIMARY })
  drawText(ps.page, 'Individual Due Diligence Report', { x: 193, y: 586, size: 13, font: ps.regular, color: PRIMARY })

  ps.page.drawLine({ start: { x: 72.52, y: 542 }, end: { x: 522.76, y: 542 }, thickness: 1.5, color: ACCENT })

  drawText(ps.page, displayName, { x: 72.52, y: 512, size: 12, font: ps.bold, color: BLACK })
  if (person.nameZh) {
    drawText(ps.page, person.nameZh, { x: 72.52, y: 492, size: 12, font: ps.bold, color: BLACK })
  }
  if (person.kycCode) {
    drawText(ps.page, `KYC 編號 Code: ${person.kycCode}`, { x: 72.52, y: 472, size: 9, font: ps.regular, color: GRAY })
  }
  drawText(ps.page, `報告日期 Report date: ${today}`, { x: 72.52, y: 452, size: 9, font: ps.regular, color: GRAY })
  drawText(ps.page, '本報告記錄身份核驗及四步 AML/CFT 篩查證明（制裁／FATF／PEP／負面新聞）。', {
    x: 72.52, y: 420, size: 8.5, font: ps.regular, color: GRAY,
  })
  drawText(ps.page, 'Identity verification and four-step screening evidence (Sanctions / FATF / PEP / Adverse media).', {
    x: 72.52, y: 404, size: 8, font: ps.regular, color: GRAY,
  })

  newPage(doc, ps)
  ps.y = H - MARGIN

  // 1. Identity
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '1. 客戶身份與核驗  Customer Identity & Verification')

  const identityRows: Array<{ label: string; value: string }> = [
    { label: '姓名（英文）\nName (EN)', value: displayName },
    { label: '姓名（中文）\nName (ZH)', value: person.nameZh || '—' },
    { label: 'KYC 編號\nKYC Code', value: person.kycCode || '—' },
    { label: '身份角色\nRole(s)', value: roles.join(', ') || '—' },
    { label: '證件類型\nID Type', value: person.idType || '—' },
    { label: '證件號碼\nID Number', value: person.idNumber || '—' },
    { label: '簽發地\nPlace of Issue', value: person.placeOfIssue || '—' },
    { label: '證件到期日\nID Expiry', value: fmt(person.idExpiryDate) },
    { label: '出生日期\nDate of Birth', value: fmt(person.dateOfBirth) },
    { label: '出生地\nPlace of Birth', value: person.placeOfBirth || '—' },
    { label: '國籍\nNationality', value: person.nationality || '—' },
    { label: '美國公民\nUS Citizen', value: person.isUsCitizen == null ? '—' : person.isUsCitizen ? '是  Yes' : '否  No' },
    { label: '自報 PEP\nSelf-declared PEP', value: person.isPep == null ? '—' : person.isPep ? '是  Yes' : '否  No' },
    { label: '住宅地址\nHome Address', value: person.homeAddress || '—' },
    { label: '聯絡地址\nContact Address', value: person.contactAddress || '—' },
    { label: '手機\nMobile', value: person.mobile || '—' },
    { label: '電郵\nEmail', value: person.email || '—' },
    { label: '就業狀況\nEmployment', value: person.employmentStatus || '—' },
    { label: '僱主\nEmployer', value: person.employerName || '—' },
    { label: '職位\nPosition', value: person.position || '—' },
    { label: '資金來源\nSource of Funds', value: person.sourceOfFunds || '—' },
    { label: '財富來源\nSources of Wealth', value: person.sourcesOfWealth?.join(', ') || '—' },
    { label: '年收入\nAnnual Income', value: person.annualIncome || '—' },
    { label: '淨資產\nNet Asset Value', value: person.netAssetValue || '—' },
    { label: 'KYC 狀態\nKYC Status', value: person.kycStatus || '—' },
    { label: '聲明日期\nDeclaration Date', value: fmt(person.declarationDate) },
  ]

  for (const row of identityRows) {
    await ensureSpace(ps, doc, ROW_H + 2)
    drawInfoBox(ps, [{ label: row.label, value: row.value }])
  }
  ps.y -= 8

  const idDocs = person.kycDocuments.filter(d =>
    ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION', 'KYC_OTHER', 'KYC_ADVERSE_MEDIA'].includes(d.documentType)
    || !d.documentType.startsWith('PERSON_'),
  )
  if (idDocs.length > 0) {
    await ensureSpace(ps, doc, 40)
    subHeader(ps, '1.1  已核驗／提交文件  Verified / Submitted Documents')
    const COL_DT_NO = 40
    const COL_DT_TYPE = Math.floor((CW - COL_DT_NO) * 0.35)
    const COL_DT_NAME = Math.floor((CW - COL_DT_NO) * 0.4)
    const COL_DT_DATE = CW - COL_DT_NO - COL_DT_TYPE - COL_DT_NAME
    drawTableHeader(ps, [
      { label: 'No.', width: COL_DT_NO, center: true },
      { label: '文件類型\nType', width: COL_DT_TYPE },
      { label: '文件名稱\nFile', width: COL_DT_NAME },
      { label: '上傳日期\nDate', width: COL_DT_DATE, center: true },
    ])
    for (let i = 0; i < idDocs.length; i++) {
      const kd = idDocs[i]
      await ensureSpace(ps, doc, ROW_H + 2)
      drawTableRow(ps, [
        { text: String(i + 1), width: COL_DT_NO, center: true },
        { text: kd.documentType, width: COL_DT_TYPE },
        { text: kd.fileName, width: COL_DT_NAME },
        { text: fmt(kd.uploadedAt), width: COL_DT_DATE, center: true },
      ])
    }
    ps.y -= 8
  }

  // 2. Screening evidence
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '2. AML/CFT 篩查證明  Screening Evidence')

  await ensureSpace(ps, doc, 28)
  drawText(ps.page, '以下按 KYC 四步流程記錄每次篩查結果（含無命中證明）。', {
    x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
  })
  ps.y -= 12
  drawText(ps.page, 'Each step records outcome, timestamp, and evidence (including clear screens).', {
    x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY,
  })
  ps.y -= 14

  await drawScreeningProofBlock(ps, doc, {
    title: '2.1  制裁名單篩查  Sanctions (AML)',
    methodZh: '系統比對個人姓名與制裁名單（OFAC / UN / HK / EU 等，不含 FATF）',
    methodEn: 'Name screening against sanctions lists (excl. FATF jurisdiction lists)',
    check: scoped.SANCTIONS,
    subjectLines: [
      `姓名 Name: ${[person.nameEn, person.nameZh].filter(Boolean).join(' / ') || '—'}`,
      `出生日期 DOB: ${fmt(person.dateOfBirth)}`,
    ],
    emptyClearMessage: {
      zh: '未發現制裁名單匹配項',
      en: 'No sanctions list matches found',
    },
  })

  await drawScreeningProofBlock(ps, doc, {
    title: '2.2  FATF 黑／灰名單（司法管轄區）  FATF Black / Grey Lists',
    methodZh: '以國籍、證件簽發地、出生地對照 FATF 黑名單／灰名單（系統內建 JSON，與 AML&PEP 頁相同）',
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
  })

  await drawScreeningProofBlock(ps, doc, {
    title: '2.3  政治公眾人物篩查  PEP (OpenSanctions)',
    methodZh: 'OpenSanctions Match API（/match/peps）對姓名等資料進行 PEP／RCA 比對',
    methodEn: 'OpenSanctions Match API (/match/peps) PEP / RCA screening',
    check: scoped.PEP,
    subjectLines: [
      `姓名 Name: ${[person.nameEn, person.nameZh].filter(Boolean).join(' / ') || '—'}`,
      `出生日期 DOB: ${fmt(person.dateOfBirth)}`,
      `國籍 Nationality: ${person.nationality || '—'}`,
    ],
    emptyClearMessage: {
      zh: '未發現 OpenSanctions PEP／RCA 命中',
      en: 'No OpenSanctions PEP / RCA matches found',
    },
  })

  const adverseEvidence = person.kycDocuments.filter(d => d.documentType === 'KYC_ADVERSE_MEDIA')
  await drawScreeningProofBlock(ps, doc, {
    title: '2.4  負面新聞／公開媒體（人工）  Adverse Media (Manual)',
    methodZh: '合規人員離線查核公開新聞後於系統標記 CLEAR 或 HIT（不依賴 Google CSE）',
    methodEn: 'Staff manual open-source news review; mark CLEAR or HIT in KYC (Google CSE not required)',
    check: scoped.ADVERSE_MEDIA,
    subjectLines: [
      `姓名 Name: ${[person.nameEn, person.nameZh].filter(Boolean).join(' / ') || '—'}`,
      adverseEvidence.length > 0
        ? `佐證文件 Evidence files: ${adverseEvidence.map(d => d.fileName).join('; ')}`
        : '佐證文件 Evidence files: （未上傳，非必須  optional — none uploaded）',
    ],
    emptyClearMessage: {
      zh: '人工審查：未發現相關負面新聞／公開媒體風險',
      en: 'Manual review: no relevant adverse media risk identified',
    },
  })

  // 3. Risk
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '3. 風險評估  Risk Assessment')

  if (riskAnswers.length > 0 || DEFAULT_RISK_ITEMS.length > 0) {
    await ensureSpace(ps, doc, 40)
    subHeader(ps, '3.1  評估項目  Assessment Items')

    if (linkedCompanyId && person.companyLinks[0]?.company) {
      const co = person.companyLinks[0].company
      const coName = [co.nameEn, co.nameZh].filter(Boolean).join(' / ')
      drawText(ps.page, `關聯公司 Linked Company: ${coName}`, {
        x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
      })
      ps.y -= 14
    }

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
    await drawAssessmentTable(ps, doc, [...defaults, ...extras])
  }

  const riskLevel = companyDdr?.overallRiskLevel ?? null
  const riskText = riskLabel(riskLevel)
  const riskCol = riskColor(riskLevel)
  const recName = recommendedByUser
    ? [recommendedByUser.nameEn, recommendedByUser.nameZh].filter(Boolean).join(' / ')
    : '—'
  const appName = approvedByUser
    ? [approvedByUser.nameEn, approvedByUser.nameZh].filter(Boolean).join(' / ')
    : '—'
  const appStatus = companyDdr?.approvalStatus === true ? '已批准  Approved'
    : companyDdr?.approvalStatus === false ? '未批准  Not approved'
      : '待批  Pending'

  await drawApprovalBox(ps, doc, '3.2  評估風險  Risk Summary', [
    { label: '整體風險等級\nOverall Risk Level', value: riskText, valueColor: riskCol },
    { label: '風險備註\nRisk Remark', value: '無備註  No Remark' },
    { label: '風險評估人員簽署\nRisk Assessor Signature', value: '', tall: true },
  ])

  await drawApprovalBox(ps, doc, '3.3  推薦  Recommendation', [
    { label: '推薦狀態\nRecommendation Status', value: recommendationLabel(companyDdr?.recommendation) },
    { label: '推薦備註\nRecommendation Remark', value: companyDdr?.recommendationNote || '' },
    { label: '推薦日期\nRecommendation Date', value: fmt(companyDdr?.recommendedAt ?? companyDdr?.reportDate) },
    { label: '推薦人員\nRecommending Officer', value: recName },
    { label: '推薦人員簽署\nRecommending Officer Signature', value: '', tall: true },
  ])

  await drawApprovalBox(ps, doc, '3.4  批准  Approval', [
    {
      label: '批准狀態\nApproval Status',
      value: appStatus,
      valueColor: companyDdr?.approvalStatus === true ? GREEN_TEXT : companyDdr?.approvalStatus === false ? RED : GRAY,
    },
    { label: '批准備註\nApproval Remark', value: companyDdr?.approvalNote || '' },
    { label: '批准日期\nApproval Date', value: fmt(companyDdr?.approvedAt) },
    { label: '批准人員\nApproval Officer', value: appName },
    { label: '批准人員簽署\nApproval Officer Signature', value: '', tall: true },
  ])

  // 4. Conclusion
  await ensureSpace(ps, doc, 120)
  sectionHeader(ps, doc, '4. 調查結論  Conclusion')

  await ensureSpace(ps, doc, 40)
  subHeader(ps, '4.1  四步篩查清單  Four-step Screening Checklist')
  const checklist: Array<{ label: string; check: PersonScopedCheck | null }> = [
    { label: '1. AML / Sanctions', check: scoped.SANCTIONS },
    { label: '2. FATF jurisdictions', check: scoped.FATF },
    { label: '3. PEP (OpenSanctions)', check: scoped.PEP },
    { label: '4. Adverse media (manual)', check: scoped.ADVERSE_MEDIA },
  ]
  for (const row of checklist) {
    await ensureSpace(ps, doc, 16)
    const ok = row.check?.result === 'CLEAR'
    drawText(ps.page, `${ok ? '✓' : '○'}  ${row.label}`, {
      x: MARGIN + 8,
      y: ps.y,
      size: 9,
      font: ps.bold,
      color: ok ? GREEN_TEXT : GRAY,
    })
    drawText(ps.page, screeningResultLabel(row.check?.result), {
      x: MARGIN + 240,
      y: ps.y,
      size: 9,
      font: ps.regular,
      color: screeningResultColor(row.check?.result),
    })
    ps.y -= 16
  }
  ps.y -= 6

  if (allFourClear) {
    drawBanner(
      ps,
      '四步篩查均為 CLEAR — 可作為建立／維持業務關係之篩查證明',
      'All four screening steps CLEAR — screening evidence supports onboarding / continuation',
      true,
    )
  } else {
    drawBanner(
      ps,
      '四步篩查尚未全部 CLEAR — 請完成 KYC 篩查後再出具結論',
      'Not all four steps are CLEAR — complete KYC screening before final conclusion',
      false,
    )
  }

  if (companyDdr) {
    ps.y -= 6
    const rBg = riskCol === GREEN_TEXT ? GREEN_BG : riskCol === RED ? RED_BG : rgb(0.99, 0.96, 0.9)
    ps.page.drawRectangle({ x: MARGIN + 4, y: ps.y - 24, width: CW - 8, height: 24, color: rBg })
    drawText(ps.page, '整體風險級別  Overall Risk Level:', {
      x: MARGIN + 10, y: ps.y - 16, size: 10, font: ps.bold, color: BLACK,
    })
    drawText(ps.page, riskText, { x: MARGIN + 220, y: ps.y - 16, size: 10, font: ps.bold, color: riskCol })
    ps.y -= 30
    if (companyDdr.recommendation) field(ps, '建議  Recommendation', companyDdr.recommendation)
    if (companyDdr.recommendationNote) field(ps, '建議備註  Recommendation Note', companyDdr.recommendationNote)
    if (companyDdr.approvalStatus !== null && companyDdr.approvalStatus !== undefined) {
      field(ps, '審批狀態  Approval Status', companyDdr.approvalStatus ? 'APPROVED 已批准' : 'NOT APPROVED 未批准')
    }
    if (companyDdr.approvalNote) field(ps, '審批備註  Approval Note', companyDdr.approvalNote)
  } else {
    drawText(ps.page, '關聯公司風險評估尚未完成（如適用）。  Linked company risk assessment pending (if applicable).', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 14
  }

  // 5. Sources
  await ensureSpace(ps, doc, 60)
  sectionHeader(ps, doc, '5. 資料來源與說明  Data Sources and Notes')

  ps.y -= 4
  for (const line of wrapText(
    '制裁名單來源如下（系統定期更新）。FATF 黑／灰名單採用與 AML&PEP 頁相同的內建 JSON。PEP 使用 OpenSanctions Match API。負面新聞為人工審查記錄。',
    ps.regular, 8.5, CW - 8,
  )) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: BLACK })
    ps.y -= 12
  }
  ps.y -= 6

  if (amlSources.length === 0) {
    drawText(ps.page, '暫無資料來源記錄。  No data source records available.', {
      x: MARGIN + 4, y: ps.y, size: 8.5, font: ps.regular, color: GRAY,
    })
    ps.y -= 14
  } else {
    const COL_SEQ = 36
    const COL_ZH = Math.floor((CW - COL_SEQ) * 0.38)
    const COL_EN = Math.floor((CW - COL_SEQ) * 0.38)
    const COL_FETCH = CW - COL_SEQ - COL_ZH - COL_EN
    drawTableHeader(ps, [
      { label: '序號\nNo.', width: COL_SEQ, center: true },
      { label: '名稱（中文）\nName (ZH)', width: COL_ZH },
      { label: '名稱（英文）\nName (EN)', width: COL_EN },
      { label: '最後更新\nLast Updated', width: COL_FETCH, center: true },
    ], 28)
    for (const src of amlSources) {
      await ensureSpace(ps, doc, ROW_H + 2)
      drawTableRow(ps, [
        { text: String(src.seqNo), width: COL_SEQ, center: true },
        { text: src.nameZh, width: COL_ZH },
        { text: src.nameEn, width: COL_EN },
        { text: fmt(src.lastFetched), width: COL_FETCH, center: true },
      ])
    }
  }

  ps.y -= 10
  for (const line of wrapText(
    '說明：制裁／FATF 匹配結果分為 CLEAR、WEAK_HIT、POTENTIAL_HIT、STRONG_HIT。本報告第 2 節所載結果以 KYC 四步篩查當時存檔為準，生成報告時不會重新自動篩查。如出現命中，須由合規人員進一步審查。',
    ps.regular, 8, CW - 8,
  )) {
    await ensureSpace(ps, doc, 11)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
  ps.y -= 10

  await ensureSpace(ps, doc, 80)
  sectionHeader(ps, doc, '6. 免責聲明  Disclaimer')

  const disclaimerZH =
    '本報告由 6AM Advisory (Hong Kong) Limited 為內部合規目的而製備，所載資料屬機密性質，'
    + '受香港《個人資料（私隱）條例》等適用數據保護法律規管。未經事先書面同意，不得向任何第三方披露本報告。'
  const disclaimerEN =
    'This report is prepared by 6AM Advisory (Hong Kong) Limited for internal compliance purposes only. '
    + 'The information contained herein is confidential and subject to applicable data protection laws including '
    + 'the Hong Kong Personal Data (Privacy) Ordinance. This report shall not be disclosed to any third party '
    + 'without prior written consent.'

  ps.y -= 4
  for (const line of wrapText(disclaimerZH, ps.regular, 8, CW - 8)) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 11
  }
  ps.y -= 4
  for (const line of wrapText(disclaimerEN, ps.regular, 8, CW - 8)) {
    await ensureSpace(ps, doc, 12)
    drawText(ps.page, line, { x: MARGIN + 4, y: ps.y, size: 8, font: ps.regular, color: GRAY })
    ps.y -= 11
  }

  return Buffer.from(await doc.save())
}
