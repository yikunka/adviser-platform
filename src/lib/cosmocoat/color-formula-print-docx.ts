import {
  AlignmentType,
  BorderStyle,
  Document,
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
import { getColorFormulaById, type FullColorFormula } from '@/lib/cosmocoat/color-formulas'
import { computeItemPercentage } from '@/lib/cosmocoat/recipes'

const PAGE_WIDTH = 16838
const PAGE_HEIGHT = 11906
const PAGE_MARGIN = 1440
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const TABLE_COLUMNS = [650, 1400, 2600, 1100, 950, 850, 850, 950, 950, 2558]
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
const CELL_MARGINS = { top: 90, bottom: 90, left: 90, right: 90 }
const HEADER_SHADING = { fill: 'D9D9D9', type: ShadingType.CLEAR }

type PrintColorFormula = FullColorFormula

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

function infoTable(formula: PrintColorFormula) {
  const factoryProduct = formula.factoryProduct
    ? `${formula.factoryProduct.productCode} ${formula.factoryProduct.name}`
    : formula.categoryLabel
  const sourceRecipe = formula.sourceRecipe
    ? `${formula.sourceRecipe.code} ${formula.sourceRecipe.name}`
    : '/'
  const half = CONTENT_WIDTH / 2

  return table([
    new TableRow({
      children: [
        cell(`配方编号: ${text(formula.code)}`, half, { bold: true, size: 19 }),
        cell(`配方名称: ${text(formula.name)}`, half, { bold: true, size: 19 }),
      ],
    }),
    new TableRow({
      children: [
        cell(`类别: ${text(formula.categoryLabel)}`, half, { size: 18 }),
        cell(`客户: ${text(formula.customerName)}`, half, { size: 18 }),
      ],
    }),
    new TableRow({
      children: [
        cell(`适用产品: ${text(factoryProduct)}`, half, { size: 18 }),
        cell(`来源配方: ${sourceRecipe}`, half, { size: 18 }),
      ],
    }),
    new TableRow({
      children: [
        cell(`基准批量: ${fixed(formula.batchQuantity)} kg`, half, { size: 18 }),
        cell(`成本单价: ${money(formula.unitCost)} 元/kg`, half, { size: 18 }),
      ],
    }),
    new TableRow({
      children: [
        cell(`备注: ${text(formula.notes)}`, CONTENT_WIDTH, { size: 18 }),
      ],
    }),
  ])
}

function formulaRows(formula: PrintColorFormula) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        '序号',
        '生产编号',
        '原料/产品名称',
        '属性',
        '用量(kg)',
        '占比',
        '实投(kg)',
        '单价(元)',
        '金额(元)',
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

  const totalActual = formula.items.some(item => item.actualWeight != null)
    ? formula.items.reduce((sum, item) => sum + (item.actualWeight ?? 0), 0)
    : null

  formula.items.forEach((item, index) => {
    const percentage = computeItemPercentage(item.quantity, formula.totalQuantity)
    rows.push(new TableRow({
      children: [
        cell(String(index + 1), TABLE_COLUMNS[0]!, { align: AlignmentType.CENTER }),
        cell(text(item.productionCode), TABLE_COLUMNS[1]!),
        cell(text(item.name), TABLE_COLUMNS[2]!),
        cell(text(item.attributeCode), TABLE_COLUMNS[3]!),
        cell(fixed(item.quantity), TABLE_COLUMNS[4]!, { align: AlignmentType.RIGHT }),
        cell(`${fixed(percentage, 2)}%`, TABLE_COLUMNS[5]!, { align: AlignmentType.RIGHT }),
        cell(item.actualWeight != null ? fixed(item.actualWeight) : '', TABLE_COLUMNS[6]!, { align: AlignmentType.RIGHT }),
        cell(money(item.unitPrice), TABLE_COLUMNS[7]!, { align: AlignmentType.RIGHT }),
        cell(money(item.amount), TABLE_COLUMNS[8]!, { align: AlignmentType.RIGHT }),
        cell(text(item.notes), TABLE_COLUMNS[9]!),
      ],
    }))
  })

  rows.push(new TableRow({
    children: [
      cell('合计', TABLE_COLUMNS.slice(0, 4).reduce((sum, width) => sum + width, 0), {
        colSpan: 4,
        bold: true,
        align: AlignmentType.RIGHT,
      }),
      cell(fixed(formula.totalQuantity), TABLE_COLUMNS[4]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('100%', TABLE_COLUMNS[5]!, { bold: true, align: AlignmentType.RIGHT }),
      cell(totalActual != null ? fixed(totalActual) : '', TABLE_COLUMNS[6]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('成本单价', TABLE_COLUMNS[7]!, { bold: true, align: AlignmentType.RIGHT }),
      cell(money(formula.unitCost), TABLE_COLUMNS[8]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('', TABLE_COLUMNS[9]!),
    ],
  }))

  return rows
}

function spacer(size = 120) {
  return new Paragraph({ spacing: { before: size, after: size }, children: [new TextRun('')] })
}

export async function loadPrintFormula(id: string): Promise<PrintColorFormula | null> {
  return getColorFormulaById(id)
}

export function buildColorFormulaPrintDocx(formula: PrintColorFormula) {
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
          children: [new TextRun({ text: '调色配方', bold: true, size: 24, font: 'Arial' })],
        }),
        infoTable(formula),
        spacer(80),
        table(formulaRows(formula)),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

export async function generateColorFormulaPrintDocxBuffer(id: string) {
  const formula = await loadPrintFormula(id)
  if (!formula) return null
  return buildColorFormulaPrintDocx(formula)
}

export function colorFormulaPrintFilename(code: string) {
  return `${code || 'color-formula'}-print.docx`
}
