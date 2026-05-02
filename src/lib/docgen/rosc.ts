import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx'
import { prisma } from '@/lib/db/prisma'

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
const headerShading = { fill: 'D9D9D9', type: ShadingType.CLEAR }
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }

function d(date: Date | null | undefined) {
  if (!date) return ''
  return date.toLocaleDateString('en-HK')
}

function becomingCessation(becoming: Date, cessation: Date | null) {
  const s = d(becoming)
  return cessation ? `${s}\n(${d(cessation)})` : s
}

function idWithCountry(
  idType: string | null,
  idPassportNo: string | null,
  issuingCountry: string | null,
  legalEntityRegNo: string | null,
  legalEntityGovLaw: string | null,
  isLegalEntity: boolean,
) {
  if (isLegalEntity) {
    const parts = [legalEntityRegNo, legalEntityGovLaw ? `(${legalEntityGovLaw})` : null].filter(Boolean)
    return parts.join(' ')
  }
  if (!idPassportNo) return ''
  if (idType === 'HKID') return `HKID: ${idPassportNo}`
  if (idType === 'PASSPORT') return issuingCountry ? `${issuingCountry} Passport: ${idPassportNo}` : `Passport: ${idPassportNo}`
  return issuingCountry ? `${idPassportNo} (${issuingCountry})` : idPassportNo
}

function hCell(text: string, width: number) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: headerShading,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16 })] })],
  })
}

function dCell(text: string, width: number) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
  })
}

export async function generateROSC(companyId: string): Promise<Buffer> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: {
      significantControllers: { orderBy: { entryDate: 'asc' } },
      designatedReps: { orderBy: { entryDate: 'asc' } },
    },
  })

  const today = new Date().toLocaleDateString('en-HK', { day: 'numeric', month: 'long', year: 'numeric' })

  // Significant Controllers table
  // Entry Date | Name | Correspondence/Office Address | ID/PPT (Country) or Reg No. | Nature of Control | Becoming Date (Cessation Date) | Remarks
  const CW = [1200, 2000, 2800, 2000, 2000, 1600, 1200] // sum = 12800

  const ctrlHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      hCell('Entry Date', CW[0]),
      hCell('Name (for Natural Person)', CW[1]),
      hCell('Correspondence Address (for Natural Person)\nPrincipal/Registered Office Address (for Specified/legal Entity)', CW[2]),
      hCell('ID/PPT No. (Issuing Country) (for Natural Person)\nRegistration No. (Place of Incorporation/Governing Law) (for Specific/Legal Entity)', CW[3]),
      hCell('Nature of Control', CW[4]),
      hCell('Becoming Date\n(Cessation Date)', CW[5]),
      hCell('Remarks', CW[6]),
    ],
  })

  const ctrlRows = company.significantControllers.map(sc =>
    new TableRow({
      children: [
        dCell(d(sc.entryDate), CW[0]),
        dCell(`${sc.nameEn}${sc.nameZh ? '\n' + sc.nameZh : ''}`, CW[1]),
        dCell(sc.correspondenceAddress ?? '', CW[2]),
        dCell(idWithCountry(sc.idType, sc.idPassportNo, sc.issuingCountry, sc.legalEntityRegNo, sc.legalEntityGovLaw, sc.isLegalEntity), CW[3]),
        dCell(sc.natureOfControl ?? '', CW[4]),
        dCell(becomingCessation(sc.becomingDate, sc.cessationDate), CW[5]),
        dCell(sc.remarks ?? '', CW[6]),
      ],
    })
  )

  const ctrlBlank = new TableRow({ children: CW.map(w => dCell('', w)) })

  // Designated Representatives table
  // Entry Date | Name | Address | Capacity | Tel/Fax No. | Becoming Date (Cessation Date) | Remarks
  const DW = [1200, 2000, 2800, 1600, 1200, 1600, 1200] // sum = 11600

  const drHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      hCell('Entry Date', DW[0]),
      hCell('Name', DW[1]),
      hCell('Address', DW[2]),
      hCell('Capacity', DW[3]),
      hCell('Tel/Fax No.', DW[4]),
      hCell('Becoming Date\n(Cessation Date)', DW[5]),
      hCell('Remarks', DW[6]),
    ],
  })

  const drRows = company.designatedReps.map(dr =>
    new TableRow({
      children: [
        dCell(d(dr.entryDate), DW[0]),
        dCell(dr.name, DW[1]),
        dCell(dr.address ?? '', DW[2]),
        dCell(dr.capacity ?? '', DW[3]),
        dCell(dr.telFax ?? '', DW[4]),
        dCell(becomingCessation(dr.becomingDate, dr.cessationDate), DW[5]),
        dCell(dr.remarks ?? '', DW[6]),
      ],
    })
  )

  const drBlank = new TableRow({ children: DW.map(w => dCell('', w)) })

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
          children: [new TextRun({ text: `Register of Significant Controllers (as of ${today})`, bold: true, size: 26 })],
          spacing: { before: 0, after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Name of Company: ${company.nameEn}${company.nameZh ? ' / ' + company.nameZh : ''}  Company Number: ${company.companyNumber ?? ''}`, size: 20 })],
          spacing: { after: 200 },
        }),

        new Table({
          width: { size: CW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
          columnWidths: CW,
          rows: [ctrlHeaderRow, ...ctrlRows, ctrlBlank, ctrlBlank],
        }),

        new Paragraph({
          children: [new TextRun({ text: 'Designated Representative', bold: true, size: 22 })],
          spacing: { before: 300, after: 120 },
        }),

        new Table({
          width: { size: DW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
          columnWidths: DW,
          rows: [drHeaderRow, ...drRows, drBlank, drBlank],
        }),
      ],
    }],
  })

  return Packer.toBuffer(doc) as Promise<Buffer>
}
