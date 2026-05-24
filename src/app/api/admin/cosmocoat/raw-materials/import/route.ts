import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { dedupeByProductionCode, parseExcelRow, toPrismaCreateData } from '@/lib/cosmocoat/raw-materials'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  const mode = String(formData?.get('mode') ?? 'upsert')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return NextResponse.json({ error: 'Excel 文件没有工作表' }, { status: 400 })
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
  const parsed = dedupeByProductionCode(
    rows.map(parseExcelRow).filter((row): row is NonNullable<typeof row> => row !== null),
  )

  if (parsed.length === 0) {
    return NextResponse.json({ error: '未找到有效原料数据（需包含生产号）' }, { status: 400 })
  }

  try {
    if (mode === 'replace') {
      await prisma.$transaction([
        prisma.cosTableRawMaterial.deleteMany(),
        prisma.cosTableRawMaterial.createMany({
          data: parsed.map(row => toPrismaCreateData(row)),
        }),
      ])
      return NextResponse.json({ imported: parsed.length, mode: 'replace', updated: 0 })
    }

    let imported = 0
    let skipped = 0
    for (const row of parsed) {
      const existing = await prisma.cosTableRawMaterial.findUnique({
        where: { productionCode: row.productionCode },
      })
      if (existing) {
        await prisma.cosTableRawMaterial.update({
          where: { id: existing.id },
          data: toPrismaCreateData(row),
        })
        skipped += 1
      } else {
        await prisma.cosTableRawMaterial.create({ data: toPrismaCreateData(row) })
        imported += 1
      }
    }

    return NextResponse.json({ imported, updated: skipped, mode: 'upsert', total: parsed.length })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '原料表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
