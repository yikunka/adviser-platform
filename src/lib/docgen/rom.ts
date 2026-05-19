import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, VerticalMergeType,
} from 'docx'
import { prisma } from '@/lib/db/prisma'

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const labelShading = { fill: 'D9D9D9', type: ShadingType.CLEAR }
const cellMargins = { top: 80, bottom: 80, left: 80, right: 80 }

// Measured from PRD_DOC/A0118_Clawvard_ ROM.docx.
const W = [1376, 609, 609, 1221, 1180, 762, 1157, 1352, 1310, 914, 952, 859, 874, 888, 647, 1182]
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

function lCell(text: string, width: number, colSpan?: number, verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    shading: labelShading,
    verticalAlign: VerticalAlign.CENTER,
    ...(colSpan && colSpan > 1 ? { columnSpan: colSpan } : {}),
    ...(verticalMerge ? { verticalMerge } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })],
  })
}

function vCell(text: string, width: number, colSpan?: number, verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    ...(colSpan && colSpan > 1 ? { columnSpan: colSpan } : {}),
    ...(verticalMerge ? { verticalMerge } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
  })
}

// Header cell: centered, bold, shaded. Supports rowSpan and colSpan.
function hCell(
  text: string,
  width: number,
  colSpan = 1,
  verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType],
) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    shading: labelShading,
    verticalAlign: VerticalAlign.CENTER,
    ...(colSpan > 1 ? { columnSpan: colSpan } : {}),
    ...(verticalMerge ? { verticalMerge } : {}),
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 16 })],
    })],
  })
}

function hCont(width: number, colSpan = 1) {
  return hCell('', width, colSpan, VerticalMergeType.CONTINUE)
}

function buildTxnHeader(): TableRow[] {
  const row1 = new TableRow({
    tableHeader: true,
    children: [
      hCell('Date of\nAcquisition\nor Transfer', W[0], 1, VerticalMergeType.RESTART),
      hCell('Allotment\nno. or\nTransfer\nno.', W[1] + W[2], 2, VerticalMergeType.RESTART),
      hCell('Shares Acquired', W[3] + W[4] + W[5] + W[6] + W[7], 5),
      hCell('Shares Transferred', W[8] + W[9] + W[10] + W[11] + W[12] + W[13] + W[14], 7),
      hCell('Shares\nHeld\n(Net\nBalance)', W[15], 1, VerticalMergeType.RESTART),
    ],
  })

  const row2 = new TableRow({
    tableHeader: true,
    children: [
      hCont(W[0]),
      hCont(W[1] + W[2], 2),
      hCell('Share\nCertificate\nno.', W[3], 1, VerticalMergeType.RESTART),
      hCell('Number\nof shares\nacquired', W[4], 1, VerticalMergeType.RESTART),
      hCell('Distinctive nos.\nof shares', W[5] + W[6], 2),
      hCell('Amount\npaid or\nagreed to\nbe\nconsidered\nas paid', W[7], 1, VerticalMergeType.RESTART),
      hCell('Number of\nshares\ntransferred', W[8], 1, VerticalMergeType.RESTART),
      hCell('Certificate\nsurrendered', W[9] + W[10], 2),
      hCell('Balance certificate', W[11] + W[12] + W[13] + W[14], 4),
      hCont(W[15]),
    ],
  })

  const row3 = new TableRow({
    tableHeader: true,
    children: [
      hCont(W[0]),
      hCont(W[1] + W[2], 2),
      hCont(W[3]),
      hCont(W[4]),
      hCell('from', W[5]),
      hCell('to', W[6]),
      hCont(W[7]),
      hCont(W[8]),
      hCell('Cert\nNo.', W[9], 1, VerticalMergeType.RESTART),
      hCell('No. of\nshares', W[10], 1, VerticalMergeType.RESTART),
      hCell('Cert.\nNo.', W[11], 1, VerticalMergeType.RESTART),
      hCell('No. of\nshares', W[12], 1, VerticalMergeType.RESTART),
      hCell('Distinctive\nnos. of\nshares', W[13] + W[14], 2),
      hCont(W[15]),
    ],
  })

  const row4 = new TableRow({
    tableHeader: true,
    children: [
      hCont(W[0]),
      hCont(W[1] + W[2], 2),
      hCont(W[3]),
      hCont(W[4]),
      hCell('from', W[5]),
      hCell('to', W[6]),
      hCont(W[7]),
      hCont(W[8]),
      hCont(W[9]),
      hCont(W[10]),
      hCont(W[11]),
      hCont(W[12]),
      hCell('from', W[13]),
      hCell('to', W[14]),
      hCont(W[15]),
    ],
  })

  return [row1, row2, row3, row4]
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

  const children: (Paragraph | Table)[] = []

  for (const member of company.members) {
    const infoRows = [
      new TableRow({ children: [
        lCell('Full Name', W[0]),
        vCell(`${member.nameEn}${member.nameZh ? ' ' + member.nameZh : ''}`, W.slice(1, 8).reduce((a, b) => a + b, 0), 7),
        lCell('Class of\nshares', W[8], undefined, VerticalMergeType.RESTART),
        vCell(member.shareClass === 'ORDINARY' ? 'Ordinary' : member.shareClass, W.slice(9, 16).reduce((a, b) => a + b, 0), 7, VerticalMergeType.RESTART),
      ] }),
      new TableRow({ children: [
        lCell('Registered address', W[0]),
        vCell(member.registeredAddress, W.slice(1, 8).reduce((a, b) => a + b, 0), 7),
        lCell('', W[8], undefined, VerticalMergeType.CONTINUE),
        vCell('', W.slice(9, 16).reduce((a, b) => a + b, 0), 7, VerticalMergeType.CONTINUE),
      ] }),
      new TableRow({ children: [
        lCell('Occupation', W[0]),
        vCell(member.occupation ?? '', W.slice(1, 8).reduce((a, b) => a + b, 0), 7),
        lCell('', W[8], undefined, VerticalMergeType.CONTINUE),
        vCell('', W.slice(9, 16).reduce((a, b) => a + b, 0), 7, VerticalMergeType.CONTINUE),
      ] }),
    ]

    const txnDataRows = member.shareTransactions.map(tx =>
      new TableRow({
        children: [
          vCell(d(tx.transactionDate), W[0]),
          vCell(tx.allotmentTransferNo ?? '', W[1]),
          vCell('', W[2]),
          vCell(tx.certificateNo ?? '', W[3]),
          vCell(tx.sharesAcquired != null ? tx.sharesAcquired.toLocaleString('en-HK') : '', W[4]),
          vCell(tx.distinctiveNosFrom != null ? String(tx.distinctiveNosFrom) : '', W[5]),
          vCell(tx.distinctiveNosTo != null ? String(tx.distinctiveNosTo) : '', W[6]),
          vCell(hkd(tx.amountPaid), W[7]),
          vCell(tx.sharesTransferred != null ? String(tx.sharesTransferred) : '', W[8]),
          vCell(tx.certificateSurrendered ?? '', W[9]),
          vCell(tx.certificateSurrenderedShares != null ? String(tx.certificateSurrenderedShares) : '', W[10]),
          vCell(tx.balanceCertificateNo ?? '', W[11]),
          vCell(tx.balanceCertificateShares != null ? String(tx.balanceCertificateShares) : '', W[12]),
          vCell(tx.balanceDistinctiveNosFrom != null ? String(tx.balanceDistinctiveNosFrom) : '', W[13]),
          vCell(tx.balanceDistinctiveNosTo != null ? String(tx.balanceDistinctiveNosTo) : '', W[14]),
          vCell(tx.sharesHeld.toLocaleString('en-HK'), W[15]),
        ],
      })
    )

    const blankRow = new TableRow({ children: W.map(w => vCell('', w)) })

    const registerTable = new Table({
      width: { size: TXN_TOTAL, type: WidthType.DXA },
      columnWidths: W,
      rows: [...infoRows, ...buildTxnHeader(), ...txnDataRows, blankRow, blankRow],
    })

    children.push(
      registerTable,
      new Paragraph({ spacing: { before: 0, after: 240 } }),
    )
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 16838, height: 11906 }, margin: { top: 1800, right: 1440, bottom: 1800, left: 1440 } } },
      children: [
        new Paragraph({
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
