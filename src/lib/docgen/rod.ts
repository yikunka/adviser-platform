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
  return date.toLocaleDateString('en-HK') // "10/4/2026"
}

function idStr(idType: string | null, idNumber: string | null, corpRegNumber: string | null) {
  if (corpRegNumber) return corpRegNumber
  if (!idType && !idNumber) return ''
  if (idType && idNumber) return `${idType}: ${idNumber}`
  return idNumber ?? idType ?? ''
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

function para(text: string, bold = false, size = 22) {
  return new Paragraph({
    children: [new TextRun({ text, bold, size })],
    spacing: { before: 0, after: 60 },
  })
}

export async function generateROD(companyId: string): Promise<Buffer> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { directors: { orderBy: { dateOfAppointment: 'asc' } } },
  })

  const today = new Date().toLocaleDateString('en-HK')

  // Column widths (landscape, sum ~14000 twips)
  // Full Name | Appt Date | Reserve Date | Cessation Date | Address | DOB | Place of Birth | Nationality | ID/Passport+Corp Reg
  const W = [1800, 1200, 1200, 1400, 2800, 1000, 1000, 1000, 1600]

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      hCell('Full Name', W[0]),
      hCell('Date of Appointment as Director', W[1]),
      hCell('Date of Nomination as Reserve Director', W[2]),
      hCell('Date of Cessation as Director or Reserve Director', W[3]),
      hCell('Address for service of documents\n(for corporation, enter registered/Principal office address)', W[4]),
      hCell('Date of Birth\n(for corporation, enter Date of Incorporation or Registration)', W[5]),
      hCell('Place of Birth\n(for corporation, enter Place of Incorporation or Registration)', W[6]),
      hCell('Nationality\n(for individual)', W[7]),
      hCell('Identity/Passport No. (for individual)\nCompany Registration Number (for corporation)', W[8]),
    ],
  })

  const dataRows = company.directors.map(dir =>
    new TableRow({
      children: [
        dCell(`${dir.nameEn}${dir.nameZh ? '\n' + dir.nameZh : ''}`, W[0]),
        dCell(d(dir.dateOfAppointment), W[1]),
        dCell(d(dir.dateAsReserve), W[2]),
        dCell(d(dir.dateOfCessation), W[3]),
        dCell(dir.addressForService, W[4]),
        dCell(d(dir.dateOfBirth), W[5]),
        dCell(dir.placeOfBirth ?? '', W[6]),
        dCell(dir.nationality ?? '', W[7]),
        dCell(idStr(dir.idType, dir.idNumber, dir.corpRegNumber), W[8]),
      ],
    })
  )

  // Add 2 blank rows like template
  const blankRow = new TableRow({
    children: W.map(w => dCell('', w)),
  })

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
          children: [new TextRun({ text: `Register of Directors (as of ${today})`, bold: true, size: 26 })],
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
        new Table({
          width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA },
          columnWidths: W,
          rows: [headerRow, ...dataRows, blankRow, blankRow],
        }),
      ],
    }],
  })

  return Packer.toBuffer(doc) as Promise<Buffer>
}
