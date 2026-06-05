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
import { type FullRecipe, serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'
import { computeItemPercentage } from '@/lib/cosmocoat/recipes'

const PAGE_WIDTH = 11906
const PAGE_HEIGHT = 16838
const PAGE_MARGIN = 1000
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const ITEM_COLUMNS = [700, 1600, 3000, 1500, 1300, 1806]
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
const CELL_MARGINS = { top: 110, bottom: 110, left: 120, right: 120 }
const HEADER_SHADING = { fill: 'EDE7DE', type: ShadingType.CLEAR }
const LABEL_SHADING = { fill: 'F7F3EC', type: ShadingType.CLEAR }

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
    spacing: { before: 0, after: 0, line: 260 },
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
    shade?: 'header' | 'label'
    colSpan?: number
    size?: number
  } = {},
) {
  return new TableCell({
    borders: BORDERS,
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.shade === 'header'
      ? HEADER_SHADING
      : options.shade === 'label'
        ? LABEL_SHADING
        : undefined,
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

function infoTable(recipe: FullRecipe) {
  const categoryLabel = recipe.category
    ? `${recipe.category.code} ${recipe.category.name}`
    : '/'

  return table([
    new TableRow({
      children: [
        cell('配方编号', 1500, { bold: true, shade: 'label' }),
        cell(text(recipe.code), 3453, { bold: true }),
        cell('名称', 1500, { bold: true, shade: 'label' }),
        cell(text(recipe.name), 3453, { bold: true }),
      ],
    }),
    new TableRow({
      children: [
        cell('类别', 1500, { bold: true, shade: 'label' }),
        cell(text(categoryLabel), 3453),
        cell('批次数量', 1500, { bold: true, shade: 'label' }),
        cell(`${fixed(recipe.batchQuantity)} kg`, 3453),
      ],
    }),
    new TableRow({
      children: [
        cell('单位成本', 1500, { bold: true, shade: 'label' }),
        cell(`${money(recipe.unitCost)} 元/kg`, CONTENT_WIDTH - 1500, { colSpan: 3 }),
      ],
    }),
  ])
}

function itemCodeAndName(item: FullRecipe['items'][number]) {
  if (item.itemType === 'raw_material' && item.rawMaterial) {
    return {
      code: item.rawMaterial.productionCode,
      name: item.rawMaterial.name,
      source: item.rawMaterial.category || '原材料',
    }
  }

  if (item.itemType === 'recipe' && item.recipe) {
    return {
      code: item.recipe.code,
      name: item.recipe.name,
      source: '半成品配方',
    }
  }

  if (item.itemType === 'product_semifinished' && item.productSemifinished) {
    return {
      code: item.productSemifinished.code,
      name: item.productSemifinished.name,
      source: 'Sol 半成品',
    }
  }

  if (item.itemType === 'factory_product' && item.factoryProduct) {
    return {
      code: item.factoryProduct.productCode,
      name: item.factoryProduct.name,
      source: '成品',
    }
  }

  return { code: '', name: '', source: '' }
}

function itemsRows(recipe: FullRecipe) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        '序号',
        '物料代码',
        '物料名称',
        '类别/来源',
        '用量(kg)',
        '占比',
      ].map((label, index) => cell(label, ITEM_COLUMNS[index]!, {
        bold: true,
        shade: 'header',
        align: AlignmentType.CENTER,
        size: 18,
      })),
    }),
  ]

  if (recipe.items.length === 0) {
    rows.push(new TableRow({
      children: [
        cell('暂无物料明细', CONTENT_WIDTH, { colSpan: ITEM_COLUMNS.length, align: AlignmentType.CENTER }),
      ],
    }))
    return rows
  }

  const totalQuantity = recipe.items.reduce((sum, item) => sum + item.quantity, 0)

  recipe.items.forEach((item, index) => {
    const percentage = computeItemPercentage(item.quantity, totalQuantity)
    const material = itemCodeAndName(item)

    rows.push(new TableRow({
      children: [
        cell(String(index + 1), ITEM_COLUMNS[0]!, { align: AlignmentType.CENTER }),
        cell(text(material.code), ITEM_COLUMNS[1]!),
        cell(text(material.name), ITEM_COLUMNS[2]!),
        cell(text(material.source), ITEM_COLUMNS[3]!),
        cell(fixed(item.quantity), ITEM_COLUMNS[4]!, { align: AlignmentType.RIGHT }),
        cell(`${fixed(percentage, 2)}%`, ITEM_COLUMNS[5]!, { align: AlignmentType.RIGHT }),
      ],
    }))
  })

  const totalQuantityVal = recipe.items.reduce((sum, item) => sum + item.quantity, 0)
  rows.push(new TableRow({
    children: [
      cell('合计', ITEM_COLUMNS.slice(0, 4).reduce((sum, w) => sum + w, 0), {
        colSpan: 4,
        bold: true,
        align: AlignmentType.RIGHT,
      }),
      cell(fixed(totalQuantityVal), ITEM_COLUMNS[4]!, { bold: true, align: AlignmentType.RIGHT }),
      cell('100%', ITEM_COLUMNS[5]!, { bold: true, align: AlignmentType.RIGHT }),
    ],
  }))

  return rows
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
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 220 },
          children: [new TextRun({ text: '配方详情', bold: true, size: 32, font: 'Arial' })],
        }),
        infoTable(recipe),
        spacer(160),
        new Paragraph({
          spacing: { before: 0, after: 90 },
          children: [new TextRun({ text: '原材料清单', bold: true, size: 22, font: 'Arial' })],
        }),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: itemsRows(recipe),
        }),
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
  return `${code || 'recipe'}-配方详情.docx`
}
