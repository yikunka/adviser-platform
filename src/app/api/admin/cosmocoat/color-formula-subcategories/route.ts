import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { isColorFormulaCategory } from '@/lib/cosmocoat/color-formula-categories'
import { listColorFormulaSubcategories } from '@/lib/cosmocoat/color-formula-subcategories'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const parentParam = req.nextUrl.searchParams.get('parentCategory')?.trim() ?? ''
  const parentCategory = isColorFormulaCategory(parentParam) ? parentParam : undefined

  try {
    const items = await listColorFormulaSubcategories(parentCategory)
    return NextResponse.json({ items })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '子类别表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
