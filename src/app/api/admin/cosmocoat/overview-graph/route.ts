import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { buildOverviewRawMaterialWhere } from '@/lib/cosmocoat/overview-graph'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  try {
    const [rawMaterials, recipes, semiFinished, factoryProducts, colorFormulas, processKits, productionOrders] =
      await Promise.all([
        prisma.cosTableRawMaterial.findMany({
          where: buildOverviewRawMaterialWhere(),
          select: { id: true, productionCode: true, name: true, category: true },
          orderBy: { productionCode: 'asc' },
        }),
        prisma.cosTableRecipe.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            items: {
              select: {
                rawMaterialId: true,
                componentRecipeId: true,
                productSemifinishedId: true,
              },
            },
          },
          orderBy: { code: 'asc' },
        }),
        prisma.cosTableProductSemifinished.findMany({
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        }),
        prisma.cosTableFactoryProduct.findMany({
          select: {
            id: true,
            productCode: true,
            name: true,
            currentRecipeId: true,
            recipeLinks: { select: { recipeId: true } },
          },
          orderBy: { productCode: 'asc' },
        }),
        prisma.cosTableColorFormula.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            sourceRecipeId: true,
            factoryProductId: true,
            items: {
              select: {
                rawMaterialId: true,
                productSemifinishedId: true,
              },
            },
          },
          orderBy: { code: 'asc' },
        }),
        prisma.cosProcessKit.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            products: { select: { productId: true } },
          },
          orderBy: { code: 'asc' },
        }),
        // Production orders to derive recipe → semi-finished edges
        prisma.cosTableProductionOrder.findMany({
          select: {
            recipeId: true,
            semifinishedProducts: { select: { id: true } },
          },
        }),
      ])

    const parseEdges = (set: Set<string>) =>
      Array.from(set).map(s => {
        const [from, to] = s.split('::')
        return { from, to }
      })

    const rawToRecipe = new Set<string>()
    const recipeToRecipe = new Set<string>()
    const semiToRecipe = new Set<string>()
    const recipeToSemiFinished = new Set<string>()
    const recipeToProduct = new Set<string>()
    const recipeToColorFormula = new Set<string>()
    const rawToColorFormula = new Set<string>()
    const semiToColorFormula = new Set<string>()
    const productToColorFormula = new Set<string>()
    const productToProcessKit = new Set<string>()

    for (const recipe of recipes) {
      for (const item of recipe.items) {
        if (item.rawMaterialId) rawToRecipe.add(`${item.rawMaterialId}::${recipe.id}`)
        if (item.componentRecipeId) recipeToRecipe.add(`${item.componentRecipeId}::${recipe.id}`)
        if (item.productSemifinishedId) semiToRecipe.add(`${item.productSemifinishedId}::${recipe.id}`)
      }
    }

    for (const order of productionOrders) {
      if (!order.recipeId) continue
      for (const sf of order.semifinishedProducts) {
        recipeToSemiFinished.add(`${order.recipeId}::${sf.id}`)
      }
    }

    for (const product of factoryProducts) {
      const linkedIds = new Set([
        ...(product.currentRecipeId ? [product.currentRecipeId] : []),
        ...product.recipeLinks.map(r => r.recipeId),
      ])
      for (const recipeId of linkedIds) {
        recipeToProduct.add(`${recipeId}::${product.id}`)
      }
    }

    for (const cf of colorFormulas) {
      if (cf.sourceRecipeId) recipeToColorFormula.add(`${cf.sourceRecipeId}::${cf.id}`)
      if (cf.factoryProductId) productToColorFormula.add(`${cf.factoryProductId}::${cf.id}`)
      for (const item of cf.items) {
        if (item.rawMaterialId) rawToColorFormula.add(`${item.rawMaterialId}::${cf.id}`)
        if (item.productSemifinishedId) semiToColorFormula.add(`${item.productSemifinishedId}::${cf.id}`)
      }
    }

    for (const kit of processKits) {
      for (const p of kit.products) {
        productToProcessKit.add(`${p.productId}::${kit.id}`)
      }
    }

    return NextResponse.json({
      nodes: {
        rawMaterials: rawMaterials.map(r => ({ id: r.id, code: r.productionCode, name: r.name, category: r.category })),
        recipes: recipes.map(r => ({ id: r.id, code: r.code, name: r.name })),
        semiFinished: semiFinished.map(s => ({ id: s.id, code: s.code, name: s.name })),
        factoryProducts: factoryProducts.map(p => ({ id: p.id, code: p.productCode, name: p.name })),
        colorFormulas: colorFormulas.map(c => ({ id: c.id, code: c.code, name: c.name })),
        processKits: processKits.map(k => ({ id: k.id, code: k.code, name: k.name })),
      },
      edges: {
        rawToRecipe: parseEdges(rawToRecipe),
        recipeToRecipe: parseEdges(recipeToRecipe),
        semiToRecipe: parseEdges(semiToRecipe),
        recipeToSemiFinished: parseEdges(recipeToSemiFinished),
        recipeToProduct: parseEdges(recipeToProduct),
        recipeToColorFormula: parseEdges(recipeToColorFormula),
        rawToColorFormula: parseEdges(rawToColorFormula),
        semiToColorFormula: parseEdges(semiToColorFormula),
        productToColorFormula: parseEdges(productToColorFormula),
        productToProcessKit: parseEdges(productToProcessKit),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load overview data' }, { status: 500 })
  }
}
