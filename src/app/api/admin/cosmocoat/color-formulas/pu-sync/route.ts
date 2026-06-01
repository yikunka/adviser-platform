import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { inferCategoryFromProductCategory } from '@/lib/cosmocoat/color-formula-categories'
import { generateColorFormulaCode } from '@/lib/cosmocoat/color-formula-code'
import { saveColorFormulaItems } from '@/lib/cosmocoat/color-formulas'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

/**
 * POST /api/admin/cosmocoat/color-formulas/pu-sync
 *
 * 1. Deletes all color formulas with category PU (or legacy LT_BAKING_PAINT if needed)
 * 2. Creates a new color formula for each factory product whose category infers to PU,
 *    expanding the full current recipe item list.
 */
export async function POST() {
  const { error } = await requireRole('SUPER_ADMIN', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  try {
    // Delete all PU color formulas
    const deleted = await prisma.cosTableColorFormula.deleteMany({
      where: { category: 'PU' },
    })

    // Find all factory products whose inferred category is PU
    const allProducts = await prisma.cosTableFactoryProduct.findMany({
      include: {
        category: { select: { id: true, name: true, slug: true } },
        currentRecipe: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
              include: {
                rawMaterial: {
                  select: {
                    id: true,
                    productionCode: true,
                    name: true,
                    attributeCode: true,
                    primaryPricePerKg: true,
                  },
                },
                componentRecipe: {
                  select: { id: true, code: true, name: true },
                },
                productSemifinished: {
                  select: { id: true, code: true, name: true, unitPrice: true },
                },
              },
            },
          },
        },
      },
    })

    const puProducts = allProducts.filter(
      p => inferCategoryFromProductCategory(p.category) === 'PU',
    )

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

        // Build items: first row = applicable product, then full recipe items
        const items: Parameters<typeof saveColorFormulaItems>[1] = [
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
          let sortOrder = 2
          for (const item of product.currentRecipe.items) {
            if (item.rawMaterial) {
              items.push({
                rawMaterialId: item.rawMaterial.id,
                sortOrder: sortOrder++,
                quantity: Number(item.quantity),
                unitPrice: item.rawMaterial.primaryPricePerKg != null
                  ? Number(item.rawMaterial.primaryPricePerKg)
                  : null,
                notes: item.notes,
              })
            } else if (item.productSemifinished) {
              items.push({
                productSemifinishedId: item.productSemifinished.id,
                sortOrder: sortOrder++,
                quantity: Number(item.quantity),
                unitPrice: item.productSemifinished.unitPrice != null
                  ? Number(item.productSemifinished.unitPrice)
                  : null,
                notes: item.notes,
              })
            }
            // component recipes are skipped — color formulas only support raw materials and semifinished
          }
        }

        await saveColorFormulaItems(formula.id, items)
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
