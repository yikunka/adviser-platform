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
import {
  JMM_BANK,
  JMM_COMPANY_NAME,
  JMM_DOCUMENT_TITLES,
  JMM_LETTERHEAD,
  formatJmmDocDate,
  jmmNumberLabel,
} from '@/lib/jmm/letterhead'

const HAIR = { style: BorderStyle.SINGLE, size: 8, color: '000000' }
const GRID = { top: HAIR, bottom: HAIR, left: HAIR, right: HAIR }
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE }

export type JmmTradeDocxInput = {
  kind: keyof typeof JMM_DOCUMENT_TITLES
  documentNumber: string
  documentDate: string
  currency: string
  customerName: string
  company: string
  vatNumber: string
  deliveryAddress: string
  notes: string
  status?: string
  lines: { description: string; packing: string; quantity: number; unitPrice: number; amount: number }[]
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function qty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

function run(value: string, options?: { bold?: boolean; size?: number }) {
  return new TextRun({ text: value, font: 'Times New Roman', size: options?.size ?? 20, bold: options?.bold })
}

function para(
  value: string,
  options?: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number },
) {
  return new Paragraph({
    alignment: options?.align,
    spacing: { before: 0, after: options?.after ?? 40 },
    children: [run(value, options)],
  })
}

function cell(
  children: Paragraph[],
  width: number,
  options?: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; span?: number; rowSpan?: number },
) {
  return new TableCell({
    borders: GRID,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    ...(options?.span ? { columnSpan: options.span } : {}),
    ...(options?.rowSpan ? { rowSpan: options.rowSpan } : {}),
    children: children.map(child => child),
  })
}

async function buildQuotationDocx(input: JmmTradeDocxInput): Promise<Buffer> {
  const logo = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), 'public/jmm/logo.jpg')).catch(() => null)
  const total = input.lines.reduce((sum, line) => sum + line.amount, 0)
  const widths = [700, 2800, 1200, 1100, 1400, 1560]
  const tableWidth = widths.reduce((sum, width) => sum + width, 0)
  const headers = ['Item', 'Description', 'Packing', 'Quantity', 'Unit price', 'Amount']
  const lineBorder = { style: BorderStyle.SINGLE, size: 4, color: '111111' }
  const grid = { top: lineBorder, bottom: lineBorder, left: lineBorder, right: lineBorder }
  const plain = (value: string, options?: { bold?: boolean; size?: number; color?: string }) => new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: value, font: 'Calibri', size: options?.size ?? 20, bold: options?.bold, color: options?.color })],
  })
  const boxed = (children: Paragraph[], width: number, fill?: string) => new TableCell({
    borders: fill === '000000' ? NO_BORDERS : grid,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    ...(fill ? { shading: { type: ShadingType.CLEAR, fill } } : {}),
    children,
  })

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Table({
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
                  : [plain('JMM', { bold: true, color: 'FFFFFF', size: 32 })],
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
                    children: [new TextRun({ text: 'QUOTATION', font: 'Calibri', size: 18, color: 'C9A96E', bold: true })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: input.documentNumber, font: 'Calibri', size: 28, color: 'FFFFFF', bold: true })],
                  }),
                ],
              }),
            ],
          })],
        }),
        new Paragraph({ spacing: { before: 160, after: 0 }, children: [new TextRun({ text: `Address: ${JMM_LETTERHEAD.address}`, font: 'Calibri', size: 18 })] }),
        new Paragraph({ spacing: { before: 40, after: 0 }, children: [new TextRun({ text: `Email: ${JMM_LETTERHEAD.email}`, font: 'Calibri', size: 18 })] }),
        new Paragraph({ spacing: { before: 40, after: 200 }, children: [new TextRun({ text: `Website: ${JMM_LETTERHEAD.website}`, font: 'Calibri', size: 18 })] }),
        plain(`Date: ${input.documentDate}`),
        plain(`Status: ${input.status ?? ''}`),
        plain(`Customer: ${input.customerName}${input.company ? ` · ${input.company}` : ''}`),
        plain(`VAT number: ${input.vatNumber || '—'}`),
        new Paragraph({ spacing: { before: 40, after: 200 }, children: [new TextRun({ text: `Delivery address: ${input.deliveryAddress || '—'}`, font: 'Calibri', size: 20 })] }),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: headers.map((label, index) => boxed([plain(label, { bold: true, size: 16 })], widths[index] ?? 1000, 'F4E8D0')),
            }),
            ...input.lines.map((line, index) => new TableRow({
              children: [
                boxed([plain(String(index + 1))], widths[0] ?? 700),
                boxed([plain(line.description)], widths[1] ?? 2800),
                boxed([plain(line.packing || '—')], widths[2] ?? 1200),
                boxed([plain(String(line.quantity))], widths[3] ?? 1100),
                boxed([plain(money(line.unitPrice))], widths[4] ?? 1400),
                boxed([plain(money(line.amount))], widths[5] ?? 1560),
              ],
            })),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: `Total price ${input.currency} ${money(total)}`, font: 'Calibri', size: 22, bold: true })],
        }),
        ...(input.notes ? [plain('Notes', { bold: true }), plain(input.notes)] : []),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}

export async function buildJmmTradeDocx(input: JmmTradeDocxInput): Promise<Buffer> {
  if (input.kind === 'QUOTATION') return buildQuotationDocx(input)
  const logo = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), 'public/jmm/logo.jpg')).catch(() => null)
  const signature = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), 'public/jmm/signature.png')).catch(() => null)
  const total = input.lines.reduce((sum, line) => sum + line.amount, 0)
  const widths = [900, 3180, 1000, 1260, 1500, 2240]
  const tableWidth = widths.reduce((sum, width) => sum + width, 0)
  const client = input.company || input.customerName
  const attention = input.company ? input.customerName : ''

  const headerRow = new TableRow({
    children: [
      cell([para('Item', { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[0], { rowSpan: 2 }),
      cell([para('Description', { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[1], { rowSpan: 2 }),
      cell([para('Packing', { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[2]),
      cell([para('Quantity', { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[3]),
      cell([para('Unit Price', { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[4]),
      cell([para('Amount', { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[5]),
    ],
  })
  const unitRow = new TableRow({
    children: [
      cell([para('', { after: 0 })], widths[2]),
      cell([para('', { after: 0 })], widths[3]),
      cell([para(`(${input.currency})`, { align: AlignmentType.CENTER, after: 0 })], widths[4]),
      cell([para(`(${input.currency})`, { align: AlignmentType.CENTER, after: 0 })], widths[5]),
    ],
  })
  const rows = input.lines.map((line, index) => new TableRow({
    children: [
      cell([para(String(index + 1), { align: AlignmentType.CENTER, after: 0 })], widths[0]),
      cell([para(line.description, { after: 0 })], widths[1]),
      cell([para(line.packing, { align: AlignmentType.CENTER, after: 0 })], widths[2]),
      cell([para(qty(line.quantity), { align: AlignmentType.CENTER, after: 0 })], widths[3]),
      cell([para(money(line.unitPrice), { align: AlignmentType.CENTER, after: 0 })], widths[4]),
      cell([para(money(line.amount), { align: AlignmentType.CENTER, after: 0 })], widths[5]),
    ],
  }))
  const totalRow = new TableRow({
    children: [
      cell([para('', { after: 0 })], widths[0], { span: 4 }),
      cell([para(`TOTAL ${input.currency}`, { bold: true, align: AlignmentType.RIGHT, after: 0 })], widths[4]),
      cell([para(money(total), { bold: true, align: AlignmentType.CENTER, after: 0 })], widths[5]),
    ],
  })

  const banner = new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: NO_BORDERS,
          width: { size: 2200, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          children: logo
            ? [new Paragraph({
                children: [new ImageRun({
                  type: 'jpg',
                  data: logo,
                  transformation: { width: 132, height: 54 },
                  altText: { title: 'JMM', description: 'JMM', name: 'JMM' },
                })],
              })]
            : [para('JMM', { bold: true, size: 28 })],
        }),
        new TableCell({
          borders: NO_BORDERS,
          width: { size: tableWidth - 2200, type: WidthType.DXA },
          children: [
            para(JMM_COMPANY_NAME, { bold: true, size: 36, align: AlignmentType.CENTER, after: 60 }),
            para(JMM_LETTERHEAD.address, { align: AlignmentType.CENTER, after: 20 }),
            para(`Tel: ${JMM_LETTERHEAD.phone}`, { align: AlignmentType.CENTER, after: 20 }),
            para(`E-mail: ${JMM_LETTERHEAD.email}`, { align: AlignmentType.CENTER, after: 20 }),
            para(`Website: ${JMM_LETTERHEAD.website}`, { align: AlignmentType.CENTER, after: 0 }),
          ],
        }),
      ],
    })],
  })

  const confirmation = new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          cell([para('CONFIRMATION', { bold: true, align: AlignmentType.CENTER, after: 0 })], tableWidth, { span: 2 }),
        ],
      }),
      new TableRow({
        children: [
          cell([para(JMM_COMPANY_NAME.toUpperCase(), { bold: true, align: AlignmentType.CENTER, after: 0 })], tableWidth / 2),
          cell([para('CLIENT', { bold: true, align: AlignmentType.CENTER, after: 0 })], tableWidth / 2),
        ],
      }),
      new TableRow({
        height: { value: 900, rule: 'atLeast' },
        children: [
          new TableCell({
            borders: GRID,
            width: { size: tableWidth / 2, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: signature
              ? [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new ImageRun({
                    type: 'png',
                    data: signature,
                    transformation: { width: 120, height: 72 },
                    altText: { title: 'Signature', description: 'JMM signature', name: 'signature' },
                  })],
                })]
              : [para('')],
          }),
          cell([para('')], tableWidth / 2),
        ],
      }),
    ],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 560, bottom: 560, left: 640, right: 640 } },
      },
      children: [
        banner,
        para(`Date: ${formatJmmDocDate(input.documentDate)}`, { after: 40 }),
        para(`${jmmNumberLabel(input.kind)}${input.documentNumber}`, { after: 40 }),
        para(`Client: ${client}`, { after: 40 }),
        para(`VAT: ${input.vatNumber || ''}`, { after: 40 }),
        para(`Delivery Address: ${input.deliveryAddress || ''}`, { after: 40 }),
        ...(attention ? [para(`Attn: ${attention}`, { after: 120 })] : [para('', { after: 80 })]),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          rows: [headerRow, unitRow, ...rows, totalRow],
        }),
        para('TERMS', { bold: true, after: 40 }),
        para(input.notes, { after: 160 }),
        para('BANK INFORMATION', { bold: true, after: 60 }),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: NO_BORDERS,
                  width: { size: tableWidth / 2, type: WidthType.DXA },
                  children: [
                    para(JMM_BANK.name, { after: 20 }),
                    para(JMM_BANK.branch, { after: 20 }),
                    ...JMM_BANK.lines.map(line => para(line, { after: 20 })),
                  ],
                }),
                new TableCell({
                  borders: NO_BORDERS,
                  width: { size: tableWidth / 2, type: WidthType.DXA },
                  children: [
                    para(`Acct Name: ${JMM_BANK.accountName}`, { after: 20 }),
                    para(`Acct #: ${JMM_BANK.accountNumber}`, { after: 20 }),
                    para(`SWIFT CODE: ${JMM_BANK.swift}`, { after: 20 }),
                  ],
                }),
              ],
            }),
          ],
        }),
        confirmation,
      ],
    }],
  })

  return Packer.toBuffer(doc)
}
