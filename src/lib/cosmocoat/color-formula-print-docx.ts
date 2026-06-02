import { readFileSync } from 'fs'
import { join } from 'path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import PizZip from 'pizzip'
import { getColorFormulaById, type FullColorFormula } from '@/lib/cosmocoat/color-formulas'
import { computeItemPercentage } from '@/lib/cosmocoat/recipes'

const PAGE_WIDTH = 16838
const PAGE_HEIGHT = 11906
const PAGE_MARGIN = 1440
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const TABLE_COLUMNS = [700, 1500, 1800, 1000, 1500, 1300, 1000, 900, 1000, 1000, 1258]
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
const CELL_MARGINS = { top: 90, bottom: 90, left: 90, right: 90 }
const HEADER_SHADING = { fill: 'D9D9D9', type: ShadingType.CLEAR }

function text(value: string | number | null | undefined) {
  const normalized = value == null ? '' : String(value)
  return normalized.trim() || '/'
}

function fixed(value: number | null | undefined, digits = 3) {
  if (value == null || !Number.isFinite(value)) return '/'
  return Number(value).toLocaleString('zh-HK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '/'
  return Number(value).toLocaleString('zh-HK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function p(
  value: string,
  options: {
    bold?: boolean
    size?: number
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
    color?: string
  } = {},
) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { before: 0, after: 0, line: 240 },
    children: value.split('\n').flatMap((line, index) => [
      ...(index > 0 ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line,
        bold: options.bold,
        size: options.size ?? 18,
        color: options.color,
        font: 'Arial',
      }),
    ]),
  })
}

function cell(
  value: string,
  width: number,
  options: {
    bold?: boolean
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    shade?: boolean
    colSpan?: number
    size?: number
  } = {},
) {
  return new TableCell({
    borders: BORDERS,
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.shade ? HEADER_SHADING : undefined,
    columnSpan: options.colSpan,
    children: [p(value, {
      bold: options.bold,
      size: options.size,
      alignment: options.align,
    })],
  })
}

function table(rows: TableRow[]) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows,
  })
}

function header() {
  let logo: Buffer | null = null
  try {
    const template = readFileSync(join(process.cwd(), 'templates', 'LM0019色漆+双固化.docx'))
    const zip = new PizZip(template)
    const image = zip.file('word/media/image1.png')?.asNodeBuffer()
    logo = image ?? null
  } catch {
    logo = null
  }

  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: {},
                width: { size: Math.round(CONTENT_WIDTH * 0.72), type: WidthType.DXA },
                children: [
                  p('销售公司:威柔新材料(广州)有限公司\n生产工厂:东莞华兴漆油有限公司\n地址: 广东省东莞市长安镇厦岗龙源街9号\n电话: 0769-85541701 网址:www.cosmocoat.cn', {
                    size: 17,
                  }),
                ],
              }),
              new TableCell({
                borders: {},
                width: { size: Math.round(CONTENT_WIDTH * 0.28), type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 0, after: 0 },
                    children: logo
                      ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 170, height: 65 } })]
                      : [new TextRun({ text: 'Cosmocoat', bold: true, size: 26, font: 'Arial' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function infoTable(formula: FullColorFormula) {
  const factoryProduct = formula.factoryProduct
    ? `${formula.factoryProduct.productCode} ${formula.factoryProduct.name}`
    : formula.categoryLabel
  const sourceRecipe = formula.sourceRecipe
    ? `${formula.sourceRecipe.code} ${formula.sourceRecipe.name}`
    : '/'

  return table([
    new TableRow({
      children: [
        cell(`调色配方: ${text(formula.name)}\n客户: ${text(formula.customerName)}`, CONTENT_WIDTH / 2, {
          bold: true,
          size: 20,
        }),
        cell(`工艺号:${text(formula.code)}\n色号:${text(formula.colorCode || formula.targetColor)}`, CONTENT_WIDTH / 2, {
          bold: true,
          size: 20,
        }),
      ],
    }),
    new TableRow({
      children: [
        cell(`素材/适用产品: ${text(factoryProduct)}`, CONTENT_WIDTH / 2, { size: 18 }),
        cell(`来源配方: ${sourceRecipe}\n基准批量: ${fixed(formula.batchQuantity)} kg`, CONTENT_WIDTH / 2, { size: 18 }),
      ],
    }),
  ])
}

function formulaRows(formula: FullColorFormula) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        '工序',
        '生产编号',
        '原料/产品名称',
        '属性/色号',
        '来源配方',
        '客户',
        '用量(kg)',
        '占比',
        '单价',
        '金额',
        '备注',
      ].map((label, index) => cell(label, TABLE_COLUMNS[index]!, {
        bold: true,
        shade: true,
        align: AlignmentType.CENTER,
        size: 16,
      })),
    }),
  ]

  if (formula.items.length === 0) {
    rows.push(new TableRow({
      children: [
        cell('暂无原材料明细', CONTENT_WIDTH, { colSpan: TABLE_COLUMNS.length, align: AlignmentType.CENTER }),
      ],
    }))
    return rows
  }

  const sourceRecipe = formula.sourceRecipe
    ? `${formula.sourceRecipe.code} ${formula.sourceRecipe.name}`
    : ''

  formula.items.forEach((item, index) => {
    const percentage = computeItemPercentage(item.quantity, formula.totalQuantity)
    rows.push(new TableRow({
      children: [
        cell(String(index + 1), TABLE_COLUMNS[0]!, { align: AlignmentType.CENTER }),
        cell(text(item.productionCode), TABLE_COLUMNS[1]!),
        cell(text(item.name), TABLE_COLUMNS[2]!),
        cell(text(item.attributeCode || formula.colorCode), TABLE_COLUMNS[3]!),
        cell(text(sourceRecipe), TABLE_COLUMNS[4]!),
        cell(text(formula.customerName), TABLE_COLUMNS[5]!),
        cell(fixed(item.quantity), TABLE_COLUMNS[6]!, { align: AlignmentType.RIGHT }),
        cell(`${fixed(percentage, 2)}%`, TABLE_COLUMNS[7]!, { align: AlignmentType.RIGHT }),
        cell(money(item.unitPrice), TABLE_COLUMNS[8]!, { align: AlignmentType.RIGHT }),
        cell(money(item.amount), TABLE_COLUMNS[9]!, { align: AlignmentType.RIGHT }),
        cell(text(item.notes), TABLE_COLUMNS[10]!),
      ],
    }))
  })

  rows.push(new TableRow({
    children: [
      cell('合计', TABLE_COLUMNS.slice(0, 6).reduce((sum, width) => sum + width, 0), {
        colSpan: 6,
        bold: true,
        align: AlignmentType.RIGHT,
      }),
      cell(fixed(formula.totalQuantity), TABLE_COLUMNS[6]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('100%', TABLE_COLUMNS[7]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('成本单价', TABLE_COLUMNS[8]!, { bold: true, align: AlignmentType.RIGHT }),
      cell(money(formula.unitCost), TABLE_COLUMNS[9]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('', TABLE_COLUMNS[10]!),
    ],
  }))

  return rows
}

function processTable(formula: FullColorFormula) {
  return table(formulaRows(formula))
}

function notesTable(formula: FullColorFormula) {
  const formulaNotes = formula.notes ? `配方备注:\n${formula.notes}` : '配方备注:\n/'
  return table([
    new TableRow({
      children: [
        cell(`${formulaNotes}\n\n备注:\n1.PU双液型产品，请在稀释后2小时（夏天）至4小时（冬天）内用完，以免固化`, CONTENT_WIDTH, {
          colSpan: 2,
          size: 17,
        }),
      ],
    }),
    new TableRow({
      children: [
        cell('前处理制程：\n1.产品使用前充分搅拌，特别是银粉、珠光等成份容易沉淀，以免出现色差及效果异常\n2.喷涂前需先以酒精或清洗剂等将素材表面灰尘，油污，脱模剂等擦拭干净后再进行涂装作业', CONTENT_WIDTH / 2, { size: 17 }),
        cell('过滤方面\n1.请使用干净的滤网过滤\n2.过滤后请将涂料盖好避免掉入灰尘或杂物导致不良率上升', CONTENT_WIDTH / 2, { size: 17 }),
      ],
    }),
    new TableRow({
      children: [
        cell('建议喷涂环境\n1.请于15-30℃，相对湿度小于70%环境下喷涂.\n2.湿度过高易造成光泽降低或发白现象.', CONTENT_WIDTH / 2, { size: 17 }),
        cell('涂料保存\n1.涂料最佳保存条件温度在15-35℃湿度在40-70℃.\n2.且避免阳光直晒或雨淋.', CONTENT_WIDTH / 2, { size: 17 }),
      ],
    }),
    new TableRow({
      children: [
        cell('*以上资料为我司提供作业之参考条件，请贵司依据实际操作条件加以调整/ *请首件做好以上基本测试性能后方可生产', CONTENT_WIDTH, {
          colSpan: 2,
          size: 17,
        }),
      ],
    }),
  ])
}

function spacer(size = 120) {
  return new Paragraph({ spacing: { before: size, after: size }, children: [new TextRun('')] })
}

export function buildColorFormulaPrintDocx(formula: FullColorFormula) {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 18 },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [{
      headers: { default: header() },
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 140 },
          children: [new TextRun({ text: '工艺', bold: true, size: 24, font: 'Arial' })],
        }),
        infoTable(formula),
        spacer(80),
        processTable(formula),
        spacer(100),
        p('如有技术咨询, 请联系负责业务同事或微信号cosmo-prc', { size: 17 }),
        spacer(80),
        notesTable(formula),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

export async function generateColorFormulaPrintDocxBuffer(id: string) {
  const formula = await getColorFormulaById(id)
  if (!formula) return null
  return buildColorFormulaPrintDocx(formula)
}

export function colorFormulaPrintFilename(code: string) {
  return `${code || 'color-formula'}-print.docx`
}
