/**
 * One-shot generator: templates/AMLO_Hit_Disposition_Memo.docx
 * Run: node scripts/build-amlo-hit-memo.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const FIRM = '6AM Advisory Limited'
const PAGE_W = convertInchesToTwip(8.27)
const MARGIN = convertInchesToTwip(0.7)
const CW = PAGE_W - MARGIN * 2
const thin = { style: BorderStyle.SINGLE, size: 4, color: '666666' }
const borders = { top: thin, bottom: thin, left: thin, right: thin }
const headerFill = 'D9D9D9'
const cellM = { top: 60, bottom: 60, left: 80, right: 80 }

function runs(text, opts = {}) {
  return text.split('\n').flatMap((line, i) => [
    ...(i > 0 ? [new TextRun({ break: 1, ...opts })] : []),
    new TextRun({ text: line, ...opts }),
  ])
}

function p(text, opts = {}) {
  const { spacingAfter = 80, spacingBefore = 0, bold, size = 18, ...rest } = opts
  return new Paragraph({
    spacing: { after: spacingAfter, before: spacingBefore },
    children: runs(text, { size, bold, ...rest }),
  })
}

function h(text) {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 4 } },
    children: [new TextRun({ text, bold: true, size: 22 })],
  })
}

function blankLine(label) {
  return p(`${label} _______________________________________________`, { size: 17, spacingAfter: 60 })
}

function kv(rows) {
  const labelW = Math.floor(CW * 0.34)
  const valueW = CW - labelW
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    rows: rows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: labelW, type: WidthType.DXA },
          margins: cellM,
          shading: { fill: headerFill },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: runs(label, { bold: true, size: 16 }) })],
        }),
        new TableCell({
          borders,
          width: { size: valueW, type: WidthType.DXA },
          margins: cellM,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ children: runs(value || ' ', { size: 16 }) })],
        }),
      ],
    })),
  })
}

function check(text) {
  return p(`□  ${text}`, { size: 17, spacingAfter: 40 })
}

const logoPath = path.join(root, 'public', 'logo.png')
const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null

const children = [
  p('TCSP / AMLO 命中处置备忘录', { bold: true, size: 28, spacingBefore: 80 }),
  p('Screening Hit Disposition Memo', { bold: true, size: 24, spacingAfter: 160 }),
  p('用途 Purpose：当客户/公司命中 PEP / AML（制裁）/ FATF 时，由 AMLO 澄清情况、附支持文件，并决议：誤報、升级 EDD、或拒绝/终止业务（无需 EDD）。', { size: 16 }),
  p('Use when a client/company hits PEP / AML sanctions / FATF. AMLO clarifies the situation, attaches supporting evidence, and decides: False Positive, Escalate to EDD, or Reject (terminate — no EDD).', { size: 15, spacingAfter: 160 }),

  h('0. 文件信息  Document Info'),
  kv([
    ['文件编号\nRef No.', ''],
    ['日期\nDate', ''],
    ['关联告警 Alert ID', ''],
    ['关联公司/客户\nCompany / Client', ''],
    ['关联自然人\nSubject (if any)', ''],
    ['筛查类型\nScreening type', '□ AML/制裁   □ PEP   □ FATF   □ 负面新闻 Adverse media'],
  ]),

  h('1. 命中概况  Hit Summary'),
  kv([
    ['筛查日期\nScreening date', ''],
    ['命中名单/来源\nList / Source', ''],
    ['匹配名称\nMatched name', ''],
    ['匹配分数/结果\nMatch score / Result', ''],
    ['主体类型\nSubject type', '□ 公司 Company    □ 个人 Individual'],
  ]),
  blankLine('命中摘要（中英） Hit summary'),
  blankLine(''),

  h('2. 情况澄清  Clarification'),
  blankLine('1) 客户真实身份 / 业务背景  Identity / business nature'),
  p('2) 与命中记录的关系  Relationship to the hit:', { bold: true, size: 17, spacingBefore: 80 }),
  check('同名不同人  Same name, different person'),
  check('历史职务/关联，现已无关  Historical role only'),
  check('确为同一人/实体  Confirmed same person/entity'),
  check('其他 Other: ________________'),
  p('3) 已完成步骤  Steps completed:', { bold: true, size: 17, spacingBefore: 120 }),
  check('核对身份证件 / CI / BR'),
  check('核对地址 / 公开登记'),
  check('询问客户并取得书面说明'),
  check('其他: ________________'),

  h('3. 支持文件  Supporting Evidence'),
  p('请列出附件，并在系统 AML Alert 上传扫描件（PDF/JPG/PNG）。', { size: 16 }),
  kv([
    ['No.1 文件名 File name', ''],
    ['No.2 文件名 File name', ''],
    ['No.3 文件名 File name', ''],
  ]),
  check('本备忘录后附证据附件  Evidence attached to this memo'),
  check('已上载系统（AML Alert）  Uploaded to system'),

  h('4. AMLO 结论  Disposition（三选一 Choose ONE）'),

  p('□  1. FALSE_POSITIVE — 誤報', { bold: true, size: 19, spacingBefore: 120 }),
  p('系统 System：FALSE_POSITIVE。无需升级；可继续标准 CDD / 维持业务关系（如适用）。\nNo escalation; continue standard CDD / relationship if applicable.', { size: 16 }),
  blankLine('理由 Reasons（须写清）'),

  p('□  2. ESCALATED — 升级（须做 EDD）', { bold: true, size: 19, spacingBefore: 160 }),
  p('系统 System：ESCALATED。有疑虑 → 启动加强尽职调查（EDD），不是直接拒绝。\nEscalate to Enhanced Due Diligence — not an automatic reject.', { size: 16 }),
  p('触发原因 Triggers:', { bold: true, size: 17, spacingBefore: 80 }),
  check('外国 PEP / RCA'),
  check('制裁名单疑似属实，需加强尽职'),
  check('FATF 高风险司法管辖区且待加强尽职'),
  check('负面新闻重大'),
  check('其他: ________________'),
  p('EDD 行动清单:', { bold: true, size: 17, spacingBefore: 80 }),
  check('取得额外身份 / 资金来源 / 财富来源证明'),
  check('高级管理层批准 Senior management approval'),
  check('加强交易/业务关系监察'),
  check('其他: ________________'),
  blankLine('EDD 负责人 / 时限 Owner / deadline'),

  p('□  3. REJECT — 拒绝客户 / 终止业务（无需 EDD）', { bold: true, size: 19, spacingBefore: 160 }),
  p('系统 System：REJECTED。不接纳或立即终止业务关系；不启动 EDD。\nReject / terminate relationship immediately — do NOT start EDD.', { size: 16 }),
  p('拒绝原因 Reasons:', { bold: true, size: 17, spacingBefore: 80 }),
  check('制裁属实'),
  check('风险不可接受'),
  check('客户不配合 / 虚假资料'),
  check('其他: ________________'),
  p('行动（仅终止相关）Actions (termination only):', { bold: true, size: 17, spacingBefore: 80 }),
  check('停止开户 / 不提供服务  Stop onboarding / do not provide services'),
  check('终止现有业务关系（如已建立）  Terminate existing relationship (if already established)'),
  check('书面通知客户（如适用）  Written notice to the client (if applicable)'),
  check('按政策评估是否另需联络 JFIU  Assess under policy whether JFIU contact is required'),
  blankLine('生效日期 Effective date'),

  h('5. 批准  Approval'),
  kv([
    ['经办 AMLO / Compliance\n姓名 Name / 签署 Signature / 日期 Date', '\n\n'],
    ['复核 MLRO（如需）\n姓名 / 签署 / 日期', '\n\n'],
    ['高级管理层（ESCALATED / REJECT 必填）\nSenior management (required for ESCALATED / REJECT)', '\n\n'],
  ]),
  p('声明：本人已审阅命中资料与支持文件，上述结论属实，符合本公司 AML/CFT 政策及香港 AMLO / TCSP 指引要求。', { size: 15, spacingBefore: 120 }),
  p('Declaration: I have reviewed the hit materials and supporting evidence. The conclusion above is accurate and consistent with the firm’s AML/CFT policy and Hong Kong AMLO / TCSP guidelines.', { size: 14 }),
]

const headerChildren = []
if (logo) {
  headerChildren.push(new Paragraph({
    spacing: { after: 40 },
    children: [
      new ImageRun({
        type: 'png',
        data: logo,
        transformation: { width: 28, height: 28 },
        altText: { name: 'logo', title: FIRM, description: FIRM },
      }),
      new TextRun({ text: `  ${FIRM}`, bold: true, size: 20 }),
    ],
  }))
} else {
  headerChildren.push(p(FIRM, { bold: true, size: 20, spacingAfter: 40 }))
}
headerChildren.push(p('机密 Confidential — AMLO Hit Disposition Memo', { size: 14, spacingAfter: 40 }))
headerChildren.push(new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
  children: [],
}))

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: convertInchesToTwip(11.69) },
        margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      },
    },
    headers: { default: new Header({ children: headerChildren }) },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 8 } },
            children: [
              new TextRun({ text: `${FIRM}  ·  `, size: 14, color: '666666' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '666666' }),
              new TextRun({ text: ' / ', size: 14, color: '666666' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '666666' }),
            ],
          }),
        ],
      }),
    },
    children,
  }],
})

const out = path.join(root, 'templates', 'AMLO_Hit_Disposition_Memo.docx')
const buf = await Packer.toBuffer(doc)
fs.writeFileSync(out, buf)
console.log('Wrote', out, buf.length, 'bytes')
