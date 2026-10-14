/**
 * SFS invoice Word (.docx) — Blue Luxury layout matching
 * SFS_Invoice_*_Logo_Blue_Luxury.docx visual template.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import type { SfsInvoice, SfsInvoiceLineItem, SfsOrder } from '@prisma/client'
import {
  SFS_BLUE_LUXURY as C,
  SFS_INVOICE_ISSUER as ISSUER,
  SFS_INVOICE_PAYMENT as PAYMENT,
  sfsFmtAmount,
  sfsFmtDate,
  sfsFmtMoney,
  sfsFmtQty,
  sfsInvoiceBaseFilename,
} from '@/lib/sfs-invoice/sfs-invoice-brand'

export type SfsInvoiceDocxPayload = SfsInvoice & {
  lineItems: SfsInvoiceLineItem[]
  order: Pick<SfsOrder, 'memorialName' | 'sampleCode' | 'clientName'> | null
}

const SERIF = 'Georgia'
const SANS = 'Arial'

/** A4 content width at 0.7" side margins ≈ 10466 DXA */
const PAGE_W = 10466
type CellBorders = {
  top: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
  bottom: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
  left: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
  right: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
}

const GOLD_BORDER = { style: BorderStyle.SINGLE, size: 8, color: C.gold }
const SOFT_BORDER = { style: BorderStyle.SINGLE, size: 6, color: C.ruleSoft }
const NONE = { style: BorderStyle.NONE, size: 0, color: C.white }
const NO_BORDERS: CellBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE }
const GOLD_GRID: CellBorders = { top: GOLD_BORDER, bottom: GOLD_BORDER, left: GOLD_BORDER, right: GOLD_BORDER }

function run(
  text: string,
  opts?: {
    bold?: boolean
    size?: number
    color?: string
    font?: string
    italics?: boolean
    allCaps?: boolean
    characterSpacing?: number
  },
) {
  return new TextRun({
    text,
    font: opts?.font ?? SERIF,
    size: opts?.size ?? 20,
    bold: opts?.bold,
    color: opts?.color ?? C.navy,
    italics: opts?.italics,
    allCaps: opts?.allCaps,
    characterSpacing: opts?.characterSpacing,
  })
}

function p(
  text: string,
  opts?: {
    bold?: boolean
    size?: number
    color?: string
    font?: string
    italics?: boolean
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    before?: number
    after?: number
    characterSpacing?: number
  },
) {
  return new Paragraph({
    alignment: opts?.align,
    spacing: { before: opts?.before ?? 0, after: opts?.after ?? 0 },
    children: [
      run(text, {
        bold: opts?.bold,
        size: opts?.size,
        color: opts?.color,
        font: opts?.font,
        italics: opts?.italics,
        characterSpacing: opts?.characterSpacing,
      }),
    ],
  })
}

function emptyP(after = 0) {
  return new Paragraph({ spacing: { before: 0, after }, children: [] })
}

function goldRule() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.gold, space: 1 } },
    spacing: { before: 80, after: 120 },
    children: [],
  })
}

function cell(
  children: Paragraph[],
  width: number,
  opts?: {
    borders?: CellBorders
    fill?: string
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    vAlign?: typeof VerticalAlign.TOP | typeof VerticalAlign.CENTER | typeof VerticalAlign.BOTTOM
    margins?: { top: number; bottom: number; left: number; right: number }
  },
) {
  return new TableCell({
    borders: opts?.borders ?? NO_BORDERS,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: opts?.vAlign ?? VerticalAlign.TOP,
    shading: opts?.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: opts?.margins ?? { top: 40, bottom: 40, left: 60, right: 60 },
    children: children.length ? children : [emptyP()],
  })
}

async function loadBrandLockup(): Promise<Buffer | null> {
  const full = path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/sfs-invoice/sfs-brand-lockup.png')
  try {
    return await readFile(full)
  } catch {
    return null
  }
}

export function sfsInvoiceDocxFilename(invoice: Pick<SfsInvoice, 'invoiceNumber'>): string {
  return `SFS_Invoice_${sfsInvoiceBaseFilename(invoice.invoiceNumber)}.docx`
}

export async function renderSfsInvoiceDocx(invoice: SfsInvoiceDocxPayload): Promise<Buffer> {
  const brand = await loadBrandLockup()
  const sorted = [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder)

  const colDesc = 5600
  const colQty = 1200
  const colUnit = 1800
  const colAmt = 1866
  const tableW = colDesc + colQty + colUnit + colAmt

  // ── Header: INVOICE | brand ─────────────────────────────────────────────
  const headerRow = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [5200, 5266],
    rows: [
      new TableRow({
        children: [
          cell(
            [
              new Paragraph({
                spacing: { after: 40 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.gold, space: 4 } },
                children: [
                  run('INVOICE', {
                    bold: true,
                    size: 56,
                    font: SERIF,
                    color: C.navy,
                    characterSpacing: 120,
                  }),
                ],
              }),
            ],
            5200,
            { margins: { top: 0, bottom: 0, left: 0, right: 80 } },
          ),
          cell(
            [
              brand
                ? new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 0 },
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: brand,
                        transformation: { width: 168, height: 63 },
                        altText: {
                          name: 'SFS',
                          title: 'S.F.S. Memorial Diamonds',
                          description: 'S.F.S. Memorial Diamonds',
                        },
                      }),
                    ],
                  })
                : new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [run('S.F.S.', { bold: true, size: 36, font: SANS })],
                  }),
            ],
            5266,
            { vAlign: VerticalAlign.CENTER, margins: { top: 0, bottom: 0, left: 80, right: 0 } },
          ),
        ],
      }),
    ],
  })

  // ── Meta: Invoice No. | Issue date | Status ─────────────────────────────
  const metaW = Math.floor(PAGE_W / 3)
  const metaBorders = (side: 'left' | 'mid' | 'right') => ({
    top: NONE,
    bottom: NONE,
    left: side === 'left' ? NONE : SOFT_BORDER,
    right: NONE,
  })
  const metaCell = (label: string, value: string, side: 'left' | 'mid' | 'right', goldValue = false) =>
    cell(
      [
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            run(`${label} `, { size: 16, font: SERIF, color: C.navy }),
            run(value, {
              size: 22,
              font: SERIF,
              bold: true,
              color: goldValue ? C.gold : C.navy,
            }),
          ],
        }),
      ],
      metaW,
      { borders: metaBorders(side), margins: { top: 40, bottom: 40, left: 100, right: 60 } },
    )

  const metaTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [metaW, metaW, PAGE_W - metaW * 2],
    rows: [
      new TableRow({
        children: [
          metaCell('Invoice No.:', invoice.invoiceNumber, 'left'),
          metaCell('Issue date:', sfsFmtDate(invoice.issueDate), 'mid'),
          metaCell('Status:', invoice.status, 'right', invoice.status === 'DRAFT'),
        ],
      }),
    ],
  })

  // ── Issuer | BILL TO ────────────────────────────────────────────────────
  const half = Math.floor(PAGE_W / 2)
  const issuerParas: Paragraph[] = [
    p(ISSUER.nameEn, { bold: true, size: 22, after: 40 }),
    p(ISSUER.nameZh, { size: 18, after: 60 }),
    p(ISSUER.address, { size: 16, after: 40 }),
    p(ISSUER.email, { size: 16, after: 0 }),
  ]
  const billParas: Paragraph[] = [
    p('BILL TO', { bold: true, size: 16, font: SANS, color: C.gold, after: 80, characterSpacing: 60 }),
    p(invoice.billToName, { bold: true, size: 24, after: 60 }),
  ]
  if (invoice.billToPhone?.trim()) billParas.push(p(invoice.billToPhone.trim(), { size: 18, after: 40 }))
  if (invoice.billToAddress?.trim()) billParas.push(p(invoice.billToAddress.trim(), { size: 18, after: 40 }))
  if (invoice.billToEmail?.trim()) billParas.push(p(invoice.billToEmail.trim(), { size: 18, after: 0 }))

  const partiesTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [half, PAGE_W - half],
    rows: [
      new TableRow({
        children: [
          cell(issuerParas, half, {
            borders: { top: NONE, bottom: NONE, left: NONE, right: GOLD_BORDER },
            margins: { top: 80, bottom: 80, left: 0, right: 160 },
          }),
          cell(billParas, PAGE_W - half, {
            margins: { top: 80, bottom: 80, left: 160, right: 0 },
          }),
        ],
      }),
    ],
  })

  // ── Sample / Memorial ───────────────────────────────────────────────────
  const sampleParts: string[] = []
  if (invoice.order?.sampleCode) sampleParts.push(`Sample ID: ${invoice.order.sampleCode}`)
  if (invoice.order?.memorialName) sampleParts.push(`Memorial: ${invoice.order.memorialName}`)
  const sampleBlock =
    sampleParts.length > 0
      ? [
          p(sampleParts.join('   |   '), { bold: true, size: 20, before: 40, after: 40 }),
          goldRule(),
        ]
      : []

  // ── Line items table ────────────────────────────────────────────────────
  const hdrCell = (text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    cell(
      [
        new Paragraph({
          alignment: align,
          spacing: { before: 60, after: 60 },
          children: [run(text, { bold: true, size: 16, font: SANS, color: C.white, characterSpacing: 40 })],
        }),
      ],
      width,
      {
        borders: GOLD_GRID,
        fill: C.navy,
        vAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
      },
    )

  const bodyCell = (
    text: string,
    width: number,
    align: (typeof AlignmentType)[keyof typeof AlignmentType],
    bold = false,
  ) =>
    cell(
      [
        new Paragraph({
          alignment: align,
          spacing: { before: 40, after: 40 },
          children: [run(text, { size: 18, bold, color: C.navy })],
        }),
      ],
      width,
      {
        borders: GOLD_GRID,
        vAlign: VerticalAlign.CENTER,
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
      },
    )

  const lineRows = sorted.map(
    (line) =>
      new TableRow({
        children: [
          bodyCell(line.description || '-', colDesc, AlignmentType.LEFT),
          bodyCell(sfsFmtQty(line.quantity), colQty, AlignmentType.RIGHT),
          bodyCell(sfsFmtAmount(line.unitPrice), colUnit, AlignmentType.RIGHT),
          bodyCell(sfsFmtAmount(line.amount), colAmt, AlignmentType.RIGHT, true),
        ],
      }),
  )

  const itemsTable = new Table({
    width: { size: tableW, type: WidthType.DXA },
    columnWidths: [colDesc, colQty, colUnit, colAmt],
    rows: [
      new TableRow({
        children: [
          hdrCell('DESCRIPTION', colDesc, AlignmentType.LEFT),
          hdrCell('QTY', colQty, AlignmentType.RIGHT),
          hdrCell('UNIT', colUnit, AlignmentType.RIGHT),
          hdrCell('AMOUNT', colAmt, AlignmentType.RIGHT),
        ],
      }),
      ...lineRows,
    ],
  })

  // ── Subtotal + TOTAL ───────────────────────────────────────────────────
  const totalsLabelW = 2200
  const totalsValueW = 2400
  const totalsPad = PAGE_W - totalsLabelW - totalsValueW

  const totalsTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [totalsPad, totalsLabelW, totalsValueW],
    rows: [
      new TableRow({
        children: [
          cell([emptyP()], totalsPad),
          cell(
            [p('Subtotal', { size: 20, align: AlignmentType.LEFT })],
            totalsLabelW,
            { margins: { top: 80, bottom: 40, left: 80, right: 40 } },
          ),
          cell(
            [p(sfsFmtMoney(invoice.subtotal, invoice.currency), { size: 20, bold: true, align: AlignmentType.RIGHT })],
            totalsValueW,
            { margins: { top: 80, bottom: 40, left: 40, right: 0 } },
          ),
        ],
      }),
      new TableRow({
        children: [
          cell([emptyP()], totalsPad),
          cell(
            [p('TOTAL', { bold: true, size: 22, align: AlignmentType.LEFT })],
            totalsLabelW,
            {
              fill: C.totalWash,
              borders: { top: GOLD_BORDER, bottom: NONE, left: NONE, right: NONE },
              margins: { top: 80, bottom: 80, left: 100, right: 40 },
              vAlign: VerticalAlign.CENTER,
            },
          ),
          cell(
            [
              p(sfsFmtMoney(invoice.total, invoice.currency), {
                bold: true,
                size: 24,
                align: AlignmentType.RIGHT,
              }),
            ],
            totalsValueW,
            {
              fill: C.totalWash,
              borders: { top: GOLD_BORDER, bottom: NONE, left: NONE, right: NONE },
              margins: { top: 80, bottom: 80, left: 40, right: 40 },
              vAlign: VerticalAlign.CENTER,
            },
          ),
        ],
      }),
    ],
  })

  // ── Payment ─────────────────────────────────────────────────────────────
  const paymentBlock = [
    goldRule(),
    p('PAYMENT INFORMATION', {
      bold: true,
      size: 16,
      font: SANS,
      color: C.gold,
      characterSpacing: 80,
      after: 120,
    }),
    p(PAYMENT.bank, { bold: true, size: 18, after: 40 }),
    p(`${PAYMENT.swift}  ·  ${PAYMENT.bankCode}`, { size: 16, after: 40 }),
    p(PAYMENT.accountNumber, { size: 16, after: 40 }),
    p(PAYMENT.accountName, { size: 16, after: 80 }),
  ]

  const notesBlock = invoice.notes?.trim()
    ? [
        p('NOTES', { bold: true, size: 16, font: SANS, color: C.gold, before: 120, after: 60 }),
        p(invoice.notes.trim(), { size: 18, after: 80 }),
      ]
    : []

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: SERIF, size: 20, color: C.navy },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 12, color: C.gold, space: 8 } },
                spacing: { before: 80, after: 0 },
                children: [],
              }),
              new Table({
                width: { size: PAGE_W, type: WidthType.DXA },
                columnWidths: [3400, 3666, 3400],
                rows: [
                  new TableRow({
                    children: [
                      cell(
                        [p(ISSUER.website, { size: 16 })],
                        3400,
                        { margins: { top: 40, bottom: 0, left: 0, right: 40 } },
                      ),
                      cell(
                        [
                          p('Thank you for your business.', {
                            size: 18,
                            color: C.gold,
                            italics: true,
                            align: AlignmentType.CENTER,
                          }),
                        ],
                        3666,
                        { margins: { top: 40, bottom: 0, left: 40, right: 40 } },
                      ),
                      cell(
                        [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            spacing: { before: 0, after: 0 },
                            children: [
                              run('Page ', { size: 16 }),
                              new TextRun({ children: [PageNumber.CURRENT], font: SERIF, size: 16, color: C.navy }),
                              run('/', { size: 16 }),
                              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SERIF, size: 16, color: C.navy }),
                            ],
                          }),
                        ],
                        3400,
                        { margins: { top: 40, bottom: 0, left: 40, right: 0 } },
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          headerRow,
          emptyP(120),
          metaTable,
          goldRule(),
          partiesTable,
          goldRule(),
          ...sampleBlock,
          itemsTable,
          emptyP(80),
          totalsTable,
          ...notesBlock,
          ...paymentBlock,
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
