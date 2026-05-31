/**
 * Import CosmoCoat raw materials from Excel into the database.
 * Usage: npx tsx scripts/import-cosmocoat-raw-materials.ts [path-to-xlsx]
 */
import 'dotenv/config'
import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { dedupeByProductionCode, parseExcelRow, toPrismaCreateData } from '../src/lib/cosmocoat/raw-materials'

const excelPath = process.argv[2] ?? '/Users/yibing/Downloads/生產編號20260511.xlsx'

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

  const workbook = XLSX.readFile(excelPath)
  const sheetName = workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
  const parsed = dedupeByProductionCode(
    rows.map(parseExcelRow).filter((row): row is NonNullable<typeof row> => row !== null),
  )

  console.log(`Parsed ${parsed.length} raw materials from ${excelPath}`)

  await prisma.cosTableRawMaterial.deleteMany()
  const result = await prisma.cosTableRawMaterial.createMany({
    data: parsed.map(row => toPrismaCreateData(row)),
  })

  console.log(`Imported ${result.count} records`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
