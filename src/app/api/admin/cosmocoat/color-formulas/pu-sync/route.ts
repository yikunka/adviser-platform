import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { inferCategoryFromProductCategory } from '@/lib/cosmocoat/color-formula-categories'
import { generateColorFormulaCode } from '@/lib/cosmocoat/color-formula-code'
import { saveColorFormulaItems, type ColorFormulaItemInput } from '@/lib/cosmocoat/color-formulas'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

const recipeItemInclude = {
  rawMaterial: {
    select: {
      id: true,
      primaryPricePerKg: true,
    },
  },
  componentRecipe: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  productSemifinished: {
    select: {
      id: true,
      unitPrice: true,
    },
  },
} as const

type RecipeItemWithSources = Prisma.CosTableRecipeItemGetPayload<{
  include: typeof recipeItemInclude
}>

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function itemUnitPrice(item: RecipeItemWithSources): number | null {
  return decimalToNumber(item.unitPrice) ??
    (item.rawMaterial ? decimalToNumber(item.rawMaterial.primaryPricePerKg) : null) ??
    (item.productSemifinished ? decimalToNumber(item.productSemifinished.unitPrice) : null)
}

async function loadRecipeItems(recipeId: string) {
  return prisma.cosTableRecipeItem.findMany({
    where: { recipeId },
    orderBy: { sortOrder: 'asc' },
    include: recipeItemInclude,
  })
}

async function expandRecipeItems(
  recipeId: string,
  scale = 1,
  path: string[] = [],
): Promise<ColorFormulaItemInput[]> {
  const items = await loadRecipeItems(recipeId)
  const expanded: ColorFormulaItemInput[] = []
  const nextPath = [...path, recipeId]

  for (const item of items) {
    const quantity = (decimalToNumber(item.quantity) ?? 0) * scale
    if (item.rawMaterial) {
      expanded.push({
        rawMaterialId: item.rawMaterial.id,
        sortOrder: 0,
        quantity,
        unitPrice: itemUnitPrice(item),
        notes: item.notes,
      })
      continue
    }

    if (item.productSemifinished) {
      expanded.push({
        productSemifinishedId: item.productSemifinished.id,
        sortOrder: 0,
        quantity,
        unitPrice: itemUnitPrice(item),
        notes: item.notes,
      })
      continue
    }

    if (item.componentRecipe) {
      if (nextPath.includes(item.componentRecipe.id)) {
        expanded.push({
          sortOrder: 0,
          quantity,
          unitPrice: itemUnitPrice(item),
          productionCode: item.componentRecipe.code,
          name: item.componentRecipe.name,
          attributeCode: '组件配方',
          notes: item.notes ? `循环引用未展开；${item.notes}` : '循环引用未展开',
        })
        continue
      }

      const componentItems = await loadRecipeItems(item.componentRecipe.id)
      const componentTotal = componentItems.reduce((sum, row) => sum + (decimalToNumber(row.quantity) ?? 0), 0)
      if (componentTotal <= 0) {
        expanded.push({
          sortOrder: 0,
          quantity,
          unitPrice: itemUnitPrice(item),
          productionCode: item.componentRecipe.code,
          name: item.componentRecipe.name,
          attributeCode: '组件配方',
          notes: item.notes ? `组件配方无可展开原料；${item.notes}` : '组件配方无可展开原料',
        })
        continue
      }

      const childItems = await expandRecipeItems(
        item.componentRecipe.id,
        quantity / componentTotal,
        nextPath,
      )
      for (const child of childItems) {
        expanded.push({
          ...child,
          notes: [item.componentRecipe.code, child.notes].filter(Boolean).join(' · '),
        })
      }
    }
  }

  return expanded
}

/**
 * POST /api/admin/cosmocoat/color-formulas/pu-sync
 *
 * 1. Deletes all color formulas with category PU
 * 2. Creates a new color formula for each factory product whose category infers to PU,
 *    copying current recipe materials, semifinished products, and expandable component recipes.
 */
export async function POST() {
  const { error } = await requireRole('SUPER_ADMIN', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  try {
    const allProducts = await prisma.cosTableFactoryProduct.findMany({
      include: {
        category: { select: { id: true, name: true, slug: true } },
        currentRecipe: {
          select: { id: true, code: true, batchQuantity: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { productCode: 'asc' }],
    })

    const puProducts = allProducts.filter(
      p => inferCategoryFromProductCategory(p.category) === 'PU',
    )

    const deleted = await prisma.cosTableColorFormula.deleteMany({
      where: { category: 'PU' },
    })

    const created: string[] = []
    const errors: string[] = []

    for (const product of puProducts) {
      try {
        const code = await generateColorFormulaCode()
        const formula = await prisma.cosTableColorFormula.create({
          data: {
            code,
            name: `${product.name} 调色配方`,
            category: 'PU',
            factoryProductId: product.id,
            sourceRecipeId: product.currentRecipe?.id ?? null,
            batchQuantity: product.currentRecipe ? Number(product.currentRecipe.batchQuantity) : 100,
            notes: product.currentRecipe
              ? `由产品 ${product.productCode} 当前配方 ${product.currentRecipe.code} 同步生成`
              : `由产品 ${product.productCode} 同步生成`,
          },
        })

        const items: ColorFormulaItemInput[] = [
          {
            sortOrder: 1,
            quantity: 0,
            unitPrice: null,
            productionCode: product.productCode,
            name: product.name,
            attributeCode: '适用产品',
            notes: product.currentRecipe ? `当前配方：${product.currentRecipe.code}` : '',
          },
        ]

        if (product.currentRecipe) {
          const recipeItems = await expandRecipeItems(product.currentRecipe.id)
          items.push(...recipeItems.map((item, index) => ({
            ...item,
            sortOrder: index + 2,
          })))
        }

        await saveColorFormulaItems(formula.id, items, Number(formula.batchQuantity))
        created.push(`${product.productCode} · ${product.name}`)
      } catch (err) {
        errors.push(`${product.productCode}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      deletedCount: deleted.count,
      createdCount: created.length,
      created,
      errors,
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
