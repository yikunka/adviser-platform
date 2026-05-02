import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from 'docx'
import { prisma } from '@/lib/db/prisma'

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const labelShading = { fill: 'D9D9D9', type: ShadingType.CLEAR }
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }

// Column widths for 15 leaf columns (total = 14200 DXA, fits A4 landscape with 720pt margins)
// [0] Date | [1] AllotNo | [2] ShareCertNo | [3] NoAcq | [4] DistFrom | [5] DistTo |
// [6] AmtPaid | [7] NoTx | [8] SurrCertNo | [9] SurrShares |
// [10] BalCertNo | [11] BalShares | [12] BalDistFrom | [13] BalDistTo | [14] SharesHeld
const W = [1300, 1100, 900, 1000, 800, 800, 1200, 1000, 900, 900, 900, 900, 800, 800, 1100]
const TXN_TOTAL = W.reduce((a, b) => a + b, 0)

function d(date: Date | null | undefined) {
  if (!date) return ''
  return date.toLocaleDateString('en-HK')
}

function hkd(amount: { toString(): string } | null) {
  if (amount == null) return ''
  const n = parseFloat(amount.toString())
  if (isNaN(n)) return ''
  return `HK$${n.toLocaleString('en-HK')}`
}

function lCell(text: string, width: number) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    shading: labelShading,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })],
  })
}

function vCell(text: string, width: number, colSpan?: number) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    ...(colSpan && colSpan > 1 ? { columnSpan: colSpan } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
  })
}

// Header cell: centered, bold, shaded. Supports rowSpan and colSpan.
function hCell(text: string, width: number, rowSpan = 1, colSpan = 1) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    shading: labelShading,
    verticalAlign: VerticalAlign.CENTER,
    ...(rowSpan > 1 ? { rowSpan } : {}),
    ...(colSpan > 1 ? { columnSpan: colSpan } : {}),
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 16 })],
    })],
  })
}

// Empty continuation cell for rowSpan (needed by OOXML after the first merged cell)
function contCell(width: number) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    children: [new Paragraph({ children: [] })],
  })
}

function buildTxnHeader(): TableRow[] {
  // Row 1: group headers
  const row1 = new TableRow({
    tableHeader: true,
    children: [
      hCell('Date of\nAcquisition\nor Transfer', W[0], 2),
      hCell('Allotment\nno. or\nTransfer no.', W[1], 2),
      hCell('Shares Acquired', W[2] + W[3] + W[4] + W[5] + W[6], 1, 5),
      hCell('Shares Transferred', W[7] + W[8] + W[9] + W[10] + W[11] + W[12] + W[13], 1, 7),
      hCell('Shares\nHeld\n(Net\nBalance)', W[14], 2),
    ],
  })

  // Row 2: leaf headers (continuation cells for rowSpan cols 0, 1, 14)
  const row2 = new TableRow({
    tableHeader: true,
    children: [
      contCell(W[0]),
      contCell(W[1]),
      hCell('Share\nCertificate\nno.', W[2]),
      hCell('No. of\nshares\nacquired', W[3]),
      hCell('Distinctive\nnos. from', W[4]),
      hCell('Distinctive\nnos. to', W[5]),
      hCell('Amount paid or\nagreed to be\nconsidered\nas paid', W[6]),
      hCell('No. of\nshares\ntransferred', W[7]),
      hCell('Certificate\nsurrendered\nCert No.', W[8]),
      hCell('Certificate\nsurrendered\nNo. of shares', W[9]),
      hCell('Balance\ncertificate\nCert. No.', W[10]),
      hCell('Balance\ncertificate\nNo. of shares', W[11]),
      hCell('Balance\ncertificate\nDist. nos.\nfrom', W[12]),
      hCell('Balance\ncertificate\nDist. nos.\nto', W[13]),
      contCell(W[14]),
    ],
  })

  return [row1, row2]
}

export async function generateROM(companyId: string): Promise<Buffer> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
        include: { shareTransactions: { orderBy: { transactionDate: 'asc' } } },
      },
    },
  })

  const today = new Date().toLocaleDateString('en-HK')

  // Member info block (label | value | label | value), full width = TXN_TOTAL
  const INFO_W = [1600, Math.floor((TXN_TOTAL - 3200) / 2), 1600, Math.floor((TXN_TOTAL - 3200) / 2)]

  const children: (Paragraph | Table)[] = []

  for (const member of company.members) {
    const infoTable = new Table({
      width: { size: TXN_TOTAL, type: WidthType.DXA },
      columnWidths: INFO_W,
      rows: [
        new TableRow({ children: [
          lCell('Full Name', INFO_W[0]),
          vCell(`${member.nameEn}${member.nameZh ? '  ' + member.nameZh : ''}`, INFO_W[1]),
          lCell('Class of shares', INFO_W[2]),
          vCell(member.shareClass, INFO_W[3]),
        ] }),
        new TableRow({ children: [
          lCell('Registered address', INFO_W[0]),
          vCell(member.registeredAddress, INFO_W[1] + INFO_W[2] + INFO_W[3], 3),
        ] }),
        new TableRow({ children: [
          lCell('Occupation', INFO_W[0]),
          vCell(member.occupation ?? '', INFO_W[1] + INFO_W[2] + INFO_W[3], 3),
        ] }),
      ],
    })

    const txnDataRows = member.shareTransactions.map(tx =>
      new TableRow({
        children: [
          vCell(d(tx.transactionDate), W[0]),
          vCell(tx.allotmentTransferNo ?? '', W[1]),
          vCell(tx.certificateNo ?? '', W[2]),
          vCell(tx.sharesAcquired != null ? String(tx.sharesAcquired) : '', W[3]),
          vCell(tx.distinctiveNosFrom != null ? String(tx.distinctiveNosFrom) : '', W[4]),
          vCell(tx.distinctiveNosTo != null ? String(tx.distinctiveNosTo) : '', W[5]),
          vCell(hkd(tx.amountPaid), W[6]),
          vCell(tx.sharesTransferred != null ? String(tx.sharesTransferred) : '', W[7]),
          vCell(tx.certificateSurrendered ?? '', W[8]),
          vCell(tx.certificateSurrenderedShares != null ? String(tx.certificateSurrenderedShares) : '', W[9]),
          vCell(tx.balanceCertificateNo ?? '', W[10]),
          vCell(tx.balanceCertificateShares != null ? String(tx.balanceCertificateShares) : '', W[11]),
          vCell(tx.balanceDistinctiveNosFrom != null ? String(tx.balanceDistinctiveNosFrom) : '', W[12]),
          vCell(tx.balanceDistinctiveNosTo != null ? String(tx.balanceDistinctiveNosTo) : '', W[13]),
          vCell(String(tx.sharesHeld), W[14]),
        ],
      })
    )

    const blankRow = new TableRow({ children: W.map(w => vCell('', w)) })

    const txnTable = new Table({
      width: { size: TXN_TOTAL, type: WidthType.DXA },
      columnWidths: W,
      rows: [...buildTxnHeader(), ...txnDataRows, blankRow, blankRow],
    })

    children.push(
      infoTable,
      new Paragraph({ spacing: { before: 0, after: 60 } }),
      txnTable,
      new Paragraph({ spacing: { before: 0, after: 240 } }),
    )
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 16838, height: 11906 }, // A4 landscape
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Register of Members (as of ${today})`, bold: true, size: 26 })],
          spacing: { before: 0, after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Name of Company: ${company.nameEn}${company.nameZh ? ' / ' + company.nameZh : ''}`, size: 20 })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Company Number: ${company.companyNumber ?? ''}`, size: 20 })],
          spacing: { after: 200 },
        }),
        ...children,
      ],
    }],
  })

  return Packer.toBuffer(doc) as Promise<Buffer>
}
