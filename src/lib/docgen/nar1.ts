import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber,
} from 'docx'
import { prisma } from '@/lib/db/prisma'

const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' }
const borders = { top: border, bottom: border, left: border, right: border }
const headerShading = { fill: 'D5E8F0', type: ShadingType.CLEAR }
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 }

function cell(text: string, width: number, bold = false, shading?: typeof headerShading) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    ...(shading ? { shading } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
  })
}

function labeledRow(label: string, value: string, labelWidth = 3000, valueWidth = 6200) {
  return new TableRow({
    children: [
      cell(label, labelWidth, true, headerShading),
      cell(value, valueWidth),
    ],
  })
}

export async function generateNAR1(companyId: string): Promise<Buffer> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      directors: { where: { status: 'ACTIVE' }, orderBy: { dateOfAppointment: 'asc' } },
      members: {
        where: { status: 'ACTIVE' },
        include: { shareTransactions: { orderBy: { transactionDate: 'desc' }, take: 1 } },
      },
      significantControllers: { where: { cessationDate: null } },
    },
  })

  const TABLE_WIDTH = 9200
  const COL = [3000, 6200]

  // ── Company Info ───────────────────────────────────────────────────
  const companyRows = [
    labeledRow('Company Name (English)', company.nameEn),
    labeledRow('Company Name (Chinese)', company.nameZh ?? ''),
    labeledRow('Company Number', company.companyNumber ?? ''),
    labeledRow('Date of Incorporation', company.dateOfIncorporation ? company.dateOfIncorporation.toLocaleDateString('en-HK') : ''),
    labeledRow('Registered Address', company.registeredAddress ?? ''),
    labeledRow('Business Registration No.', company.businessRegNumber ?? ''),
    labeledRow('BR Expiry Date', company.brExpiryDate ? company.brExpiryDate.toISOString().split('T')[0] : ''),
    labeledRow('Financial Year End (Month)', company.financialYearEndMonth != null ? String(company.financialYearEndMonth) : ''),
  ]

  // ── Directors ──────────────────────────────────────────────────────
  const DIR_WIDTHS = [2600, 2600, 2000, 2000] // sum = 9200
  const dirHeaderRow = new TableRow({
    children: ['Full Name', 'Address for Service', 'Date of Appointment', 'Nationality'].map(
      (h, i) => cell(h, DIR_WIDTHS[i], true, headerShading)
    ),
  })
  const dirRows = company.directors.map(d =>
    new TableRow({
      children: [
        cell(`${d.nameEn}${d.nameZh ? ` / ${d.nameZh}` : ''}`, DIR_WIDTHS[0]),
        cell(d.addressForService, DIR_WIDTHS[1]),
        cell(d.dateOfAppointment.toISOString().split('T')[0], DIR_WIDTHS[2]),
        cell(d.nationality ?? '', DIR_WIDTHS[3]),
      ],
    })
  )

  // ── Members ────────────────────────────────────────────────────────
  const MEM_WIDTHS = [2600, 2600, 2000, 2000] // sum = 9200
  const memHeaderRow = new TableRow({
    children: ['Full Name', 'Registered Address', 'Share Class', 'Shares Held'].map(
      (h, i) => cell(h, MEM_WIDTHS[i], true, headerShading)
    ),
  })
  const memRows = company.members.map(m => {
    const lastTx = m.shareTransactions[0]
    return new TableRow({
      children: [
        cell(`${m.nameEn}${m.nameZh ? ` / ${m.nameZh}` : ''}`, MEM_WIDTHS[0]),
        cell(m.registeredAddress, MEM_WIDTHS[1]),
        cell(m.shareClass, MEM_WIDTHS[2]),
        cell(lastTx ? String(lastTx.sharesHeld) : '—', MEM_WIDTHS[3]),
      ],
    })
  })

  // ── Significant Controllers ────────────────────────────────────────
  const SC_WIDTHS = [2600, 2600, 2000, 2000] // sum = 9200
  const scHeaderRow = new TableRow({
    children: ['Full Name', 'Correspondence Address', 'Nature of Control', 'Becoming Date'].map(
      (h, i) => cell(h, SC_WIDTHS[i], true, headerShading)
    ),
  })
  const scRows = company.significantControllers.map(sc =>
    new TableRow({
      children: [
        cell(`${sc.nameEn}${sc.nameZh ? ` / ${sc.nameZh}` : ''}`, SC_WIDTHS[0]),
        cell(sc.correspondenceAddress ?? '', SC_WIDTHS[1]),
        cell(sc.natureOfControl ?? '', SC_WIDTHS[2]),
        cell(sc.becomingDate.toISOString().split('T')[0], SC_WIDTHS[3]),
      ],
    })
  )

  function section(title: string) {
    return new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 24, color: '2E5FA3' })],
      spacing: { before: 320, after: 160 },
    })
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 800, bottom: 1000, left: 800 } },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'ANNUAL RETURN (NAR1) — PRE-FILLED DRAFT', bold: true, size: 24 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${company.nameEn} | Co. No. ${company.companyNumber} | Generated: ${new Date().toLocaleDateString('en-HK')}`, size: 18 })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Page ', size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })],
          })],
        }),
      },
      children: [
        section('Part 1 — Company Particulars'),
        new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: COL, rows: companyRows }),

        section('Part 2 — Directors'),
        new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: DIR_WIDTHS, rows: [dirHeaderRow, ...dirRows] }),

        section('Part 3 — Members / Shareholders'),
        new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: MEM_WIDTHS, rows: [memHeaderRow, ...memRows] }),

        section('Part 4 — Significant Controllers'),
        new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, columnWidths: SC_WIDTHS, rows: [scHeaderRow, ...scRows] }),

        new Paragraph({
          children: [new TextRun({ text: 'Note: This is a pre-filled draft for reference only. Please verify all information before submission to the Companies Registry.', size: 16, italics: true, color: '888888' })],
          spacing: { before: 400 },
        }),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}
