import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { isColorFormulaCategory } from '@/lib/cosmocoat/color-formula-categories'
import { generateColorFormulaFromProduct } from '@/lib/cosmocoat/color-formulas'

const bodySchema = z.object({
  factoryProductId: z.string().trim().min(1),
  category: z.string().trim().optional(),
  name: z.string().trim().max(160).optional(),
  batchQuantity: z.coerce.number().min(0.001).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.category && !isColorFormulaCategory(parsed.data.category)) {
    return NextResponse.json({ error: '无效的配方类别' }, { status: 400 })
  }

  const category = parsed.data.category && isColorFormulaCategory(parsed.data.category)
    ? parsed.data.category
    : undefined

  try {
    const result = await generateColorFormulaFromProduct({
      factoryProductId: parsed.data.factoryProductId,
      category,
      name: parsed.data.name,
      batchQuantity: parsed.data.batchQuantity,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ formula: result.formula }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
