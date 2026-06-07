import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const categorySchema = z.object({
  code: z.string().trim().min(1).max(16),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional().default(0),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  try {
    const categories = await prisma.cosTableRecipeCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: {
        recipes: {
          orderBy: [{ code: 'asc' }],
          select: {
            id: true,
            code: true,
            name: true,
            batchQuantity: true,
            unitCost: true,
            viscosity: true,
            viscosityUnit: true,
            updatedAt: true,
          },
        },
      },
    })

    return NextResponse.json({
      categories: categories.map(category => ({
        ...category,
        recipes: category.recipes.map(recipe => ({
          ...recipe,
          batchQuantity: Number(recipe.batchQuantity),
          unitCost: recipe.unitCost != null ? Number(recipe.unitCost) : null,
          updatedAt: recipe.updatedAt.toISOString(),
        })),
      })),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRecipes' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const existing = await prisma.cosTableRecipeCategory.findUnique({ where: { code: parsed.data.code } })
    if (existing) return NextResponse.json({ error: '目录编号已存在' }, { status: 409 })

    const created = await prisma.cosTableRecipeCategory.create({ data: parsed.data })
    return NextResponse.json({ category: created }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
