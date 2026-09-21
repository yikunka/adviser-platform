import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import { JMM_DOCUMENT_TITLES, JMM_LETTERHEAD } from '@/lib/jmm/letterhead'

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE }
const LINE = { style: BorderStyle.SINGLE, size: 4, color: '111111' }
const GRID = { top: LINE, bottom: LINE, left: LINE, right: LINE }

export type JmmTradeDocxInput = {
  kind: keyof typeof JMM_DOCUMENT_TITLES
  documentNumber: string
  status: string
  documentDate: string
  currency: string
  customerName: string
  company: string
  vatNumber: string
  deliveryAddress: string
  notes: string
  lines: { description: string; packing: string; quantity: number; unitPrice: number; amount: number }[]
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function text(value: string, options?: { bold?: boolean; size?: number; color?: string }) {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: value, font: 'Calibri', size: options?.size ?? 20, bold: options?.bold, color: options?.color })],
  })
}

function cell(children: Paragraph[], width: number, options?: { fill?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; span?: number }) {
  return new TableCell({
    borders: options?.fill === '000000' ? NO_BORDERS : GRID,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    ...(options?.span ? { columnSpan: options.span } : {}),
    ...(options?.fill ? { shading: { type: ShadingType.CLEAR, fill: options.fill } } : {}),
    children,
  })
}

export async function buildJmmTradeDocx(input: JmmTradeDocxInput): Promise<Buffer> {
  const logo = await readFile(path.join(process.cwd(), 'public/jmm/logo.jpg')).catch(() => null)
  const total = input.lines.reduce((sum, line) => sum + line.amount, 0)
  const widths = [700, 2800, 1200, 1100, 1400, 1560]
  const tableWidth = widths.reduce((sum, width) => sum + width, 0)
  const headers = ['Item', 'Description', 'Packing', 'Quantity', 'Unit price', 'Amount']

  const headerRow = new TableRow({
    children: headers.map((label, index) => cell(
      [text(label, { bold: true, size: 16 })],
      widths[index] ?? 1000,
      { fill: 'F4E8D0' },
    )),
  })

  const rows = input.lines.map((line, index) => new TableRow({
    children: [
      cell([text(String(index + 1))], widths[0] ?? 700),
      cell([text(line.description)], widths[1] ?? 2800),
      cell([text(line.packing || '—')], widths[2] ?? 1200),
      cell([text(String(line.quantity))], widths[3] ?? 1100),
      cell([text(money(line.unitPrice))], widths[4] ?? 1400),
      cell([text(money(line.amount))], widths[5] ?? 1560),
    ],
  }))

  const banner = new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: NO_BORDERS,
          width: { size: 5200, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: '000000' },
          margins: { top: 120, bottom: 120, left: 160, right: 80 },
          verticalAlign: VerticalAlign.CENTER,
          children: logo
            ? [new Paragraph({
                children: [new ImageRun({
                  type: 'jpg',
                  data: logo,
                  transformation: { width: 200, height: 81 },
                  altText: { title: 'JMM', description: 'JMM', name: 'JMM' },
                })],
              })]
            : [text('JMM', { bold: true, color: 'FFFFFF', size: 32 })],
        }),
        new TableCell({
          borders: NO_BORDERS,
          width: { size: tableWidth - 5200, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: '000000' },
          margins: { top: 120, bottom: 120, left: 80, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: JMM_DOCUMENT_TITLES[input.kind].toUpperCase(), font: 'Calibri', size: 18, color: 'C9A96E', bold: true })],
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: input.documentNumber, font: 'Calibri', size: 28, color: 'FFFFFF', bold: true })],
            }),
          ],
        }),
      ],
    })],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
      },
      children: [
        banner,
        new Paragraph({ spacing: { before: 160, after: 0 }, children: [new TextRun({ text: `Address: ${JMM_LETTERHEAD.address}`, font: 'Calibri', size: 18 })] }),
        new Paragraph({ spacing: { before: 40, after: 0 }, children: [new TextRun({ text: `Email: ${JMM_LETTERHEAD.email}`, font: 'Calibri', size: 18 })] }),
        new Paragraph({ spacing: { before: 40, after: 200 }, children: [new TextRun({ text: `Website: ${JMM_LETTERHEAD.website}`, font: 'Calibri', size: 18 })] }),
        text(`Date: ${input.documentDate}`),
        text(`Status: ${input.status}`),
        text(`Customer: ${input.customerName}${input.company ? ` · ${input.company}` : ''}`),
        text(`VAT number: ${input.vatNumber || '—'}`),
        new Paragraph({ spacing: { before: 40, after: 200 }, children: [new TextRun({ text: `Delivery address: ${input.deliveryAddress || '—'}`, font: 'Calibri', size: 20 })] }),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          rows: [headerRow, ...rows],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: `Total price ${input.currency} ${money(total)}`, font: 'Calibri', size: 22, bold: true })],
        }),
        ...(input.notes ? [text('Notes', { bold: true }), text(input.notes)] : []),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}
