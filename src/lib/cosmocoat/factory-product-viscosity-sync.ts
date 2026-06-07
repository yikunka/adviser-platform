import type { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { toFactoryViscosityDbData } from '@/lib/cosmocoat/factory-product-viscosity'

type DbClient = Prisma.TransactionClient | PrismaClient

type ViscositySource = {
  viscosity?: string | null
  viscosityUnit?: string | null
}

export function resolveFactoryProductViscosity(
  product: ViscositySource,
  currentRecipe: ViscositySource | null | undefined,
) {
  if (currentRecipe) {
    return toFactoryViscosityDbData({
      viscosity: currentRecipe.viscosity,
      viscosityUnit: currentRecipe.viscosityUnit,
    })
  }
  return toFactoryViscosityDbData({
    viscosity: product.viscosity,
    viscosityUnit: product.viscosityUnit,
  })
}

export async function syncFactoryProductsViscosityFromRecipe(
  recipeId: string,
  db: DbClient = prisma,
) {
  const recipe = await db.cosTableRecipe.findUnique({
    where: { id: recipeId },
    select: { viscosity: true, viscosityUnit: true },
  })
  if (!recipe) return { updatedCount: 0 }

  const result = await db.cosTableFactoryProduct.updateMany({
    where: { currentRecipeId: recipeId },
    data: toFactoryViscosityDbData(recipe),
  })
  return { updatedCount: result.count }
}

export async function syncFactoryProductViscosityFromCurrentRecipe(
  productId: string,
  db: DbClient = prisma,
) {
  const product = await db.cosTableFactoryProduct.findUnique({
    where: { id: productId },
    select: {
      currentRecipeId: true,
      currentRecipe: { select: { viscosity: true, viscosityUnit: true } },
    },
  })
  if (!product?.currentRecipeId || !product.currentRecipe) return false

  await db.cosTableFactoryProduct.update({
    where: { id: productId },
    data: toFactoryViscosityDbData(product.currentRecipe),
  })
  return true
}
