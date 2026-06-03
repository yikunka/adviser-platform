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
import { type FullRecipe, serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'
import { computeItemPercentage } from '@/lib/cosmocoat/recipes'

const PAGE_WIDTH = 16838
const PAGE_HEIGHT = 11906
const PAGE_MARGIN = 1440
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const TABLE_COLUMNS = [700, 1500, 2200, 1000, 1000, 1500, 900, 1000, 1000, 1458]
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

function infoTable(recipe: FullRecipe) {
  const categoryLabel = recipe.category
    ? `${recipe.category.code} ${recipe.category.name}`
    : '/'

  return table([
    new TableRow({
      children: [
        cell(`工艺书: ${text(recipe.name)}`, CONTENT_WIDTH / 2, {
          bold: true,
          size: 20,
        }),
        cell(`配方编号: ${text(recipe.code)}\n每生产产品数量: ${fixed(recipe.batchQuantity)} kg`, CONTENT_WIDTH / 2, {
          bold: true,
          size: 20,
        }),
      ],
    }),
    new TableRow({
      children: [
        cell(`目录: ${text(categoryLabel)}`, CONTENT_WIDTH / 2, { size: 18 }),
        cell(`成本单价: ${money(recipe.unitCost)} 元/kg`, CONTENT_WIDTH / 2, { size: 18 }),
      ],
    }),
  ])
}

function itemsRows(recipe: FullRecipe) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        '序号',
        '生产编号',
        '原料/产品名称',
        '属性',
        '规格',
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

  if (recipe.items.length === 0) {
    rows.push(new TableRow({
      children: [
        cell('暂无原料明细', CONTENT_WIDTH, { colSpan: TABLE_COLUMNS.length, align: AlignmentType.CENTER }),
      ],
    }))
    return rows
  }

  const totalQuantity = recipe.items.reduce((sum, item) => sum + item.quantity, 0)

  recipe.items.forEach((item, index) => {
    const percentage = computeItemPercentage(item.quantity, totalQuantity)
    let productionCode = ''
    let name = ''
    let attributeCode = ''
    let packageKg: number | null = null

    if (item.itemType === 'raw_material' && item.rawMaterial) {
      productionCode = item.rawMaterial.productionCode
      name = item.rawMaterial.name
      attributeCode = item.rawMaterial.attributeCode
      packageKg = item.rawMaterial.packageKg
    } else if (item.itemType === 'recipe' && item.recipe) {
      productionCode = item.recipe.code
      name = item.recipe.name
      attributeCode = '半成品配方'
      packageKg = item.recipe.batchQuantity
    } else if (item.itemType === 'product_semifinished' && item.productSemifinished) {
      productionCode = item.productSemifinished.code
      name = item.productSemifinished.name
      attributeCode = 'Sol.'
      packageKg = null
    }

    rows.push(new TableRow({
      children: [
        cell(String(index + 1), TABLE_COLUMNS[0]!, { align: AlignmentType.CENTER }),
        cell(text(productionCode), TABLE_COLUMNS[1]!),
        cell(text(name), TABLE_COLUMNS[2]!),
        cell(text(attributeCode), TABLE_COLUMNS[3]!),
        cell(packageKg != null ? fixed(packageKg) : '/', TABLE_COLUMNS[4]!),
        cell(fixed(item.quantity), TABLE_COLUMNS[5]!, { align: AlignmentType.RIGHT }),
        cell(`${fixed(percentage, 2)}%`, TABLE_COLUMNS[6]!, { align: AlignmentType.RIGHT }),
        cell(money(item.unitPrice), TABLE_COLUMNS[7]!, { align: AlignmentType.RIGHT }),
        cell(money(item.amount), TABLE_COLUMNS[8]!, { align: AlignmentType.RIGHT }),
        cell(text(item.notes), TABLE_COLUMNS[9]!),
      ],
    }))
  })

  const totalQuantityVal = recipe.items.reduce((sum, item) => sum + item.quantity, 0)
  rows.push(new TableRow({
    children: [
      cell('合计', TABLE_COLUMNS.slice(0, 5).reduce((sum, w) => sum + w, 0), {
        colSpan: 5,
        bold: true,
        align: AlignmentType.RIGHT,
      }),
      cell(fixed(totalQuantityVal), TABLE_COLUMNS[5]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('100%', TABLE_COLUMNS[6]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('成本单价', TABLE_COLUMNS[7]!, { bold: true, align: AlignmentType.RIGHT }),
      cell(money(recipe.unitCost), TABLE_COLUMNS[8]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('', TABLE_COLUMNS[9]!),
    ],
  }))

  return rows
}

function notesTable(recipe: FullRecipe) {
  const rows: TableRow[] = []

  const notesParts: string[] = []
  if (recipe.notes) notesParts.push(`备注:\n${recipe.notes}`)
  if (!notesParts.length) notesParts.push('备注:\n/')

  rows.push(new TableRow({
    children: [
      cell(notesParts.join('\n\n'), CONTENT_WIDTH, { colSpan: 2, size: 17 }),
    ],
  }))

  if (recipe.stirringRequirements || recipe.packagingRequirements || recipe.productionNotes) {
    rows.push(new TableRow({
      children: [
        cell(
          recipe.stirringRequirements
            ? `生产要求:\n${recipe.stirringRequirements}`
            : '生产要求:\n/',
          CONTENT_WIDTH / 2,
          { size: 17 },
        ),
        cell(
          recipe.packagingRequirements
            ? `包装要求:\n${recipe.packagingRequirements}`
            : '包装要求:\n/',
          CONTENT_WIDTH / 2,
          { size: 17 },
        ),
      ],
    }))
    if (recipe.productionNotes) {
      rows.push(new TableRow({
        children: [
          cell(`生产注意事项:\n${recipe.productionNotes}`, CONTENT_WIDTH, { colSpan: 2, size: 17 }),
        ],
      }))
    }
  }

  if (recipe.qcTestStandard || recipe.qcResult) {
    rows.push(new TableRow({
      children: [
        cell(
          recipe.qcTestStandard ? `测试标准:\n${recipe.qcTestStandard}` : '测试标准:\n/',
          CONTENT_WIDTH / 2,
          { size: 17 },
        ),
        cell(
          recipe.qcResult ? `结果:\n${recipe.qcResult}` : '结果:\n/',
          CONTENT_WIDTH / 2,
          { size: 17 },
        ),
      ],
    }))
  }

  return table(rows)
}

function spacer(size = 120) {
  return new Paragraph({ spacing: { before: size, after: size }, children: [new TextRun('')] })
}

export function buildRecipePrintDocx(recipe: FullRecipe) {
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
          children: [new TextRun({ text: '工艺书', bold: true, size: 24, font: 'Arial' })],
        }),
        infoTable(recipe),
        spacer(80),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: itemsRows(recipe),
        }),
        spacer(100),
        notesTable(recipe),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

export async function generateRecipePrintDocxBuffer(id: string) {
  const recipe = await serializeFullRecipe(id)
  if (!recipe) return null
  return buildRecipePrintDocx(recipe)
}

export function recipePrintFilename(code: string) {
  return `${code || 'recipe'}-工艺书.docx`
}
