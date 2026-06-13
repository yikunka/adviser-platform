import type { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { formatFactoryProductDisplayName } from '@/lib/cosmocoat/factory-product-display'

type DbClient = Prisma.TransactionClient | PrismaClient

async function getDbClient() {
  const { prisma } = await import('@/lib/db/prisma')
  return prisma as DbClient
}

export async function syncProcessKitProductsForFactoryProduct(
  factoryProductId: string,
  db?: DbClient,
) {
  const client = db ?? await getDbClient()
  const product = await client.cosTableFactoryProduct.findUnique({
    where: { id: factoryProductId },
    select: { productCode: true, name: true },
  })
  if (!product) return { updatedCount: 0 }

  const displayName = formatFactoryProductDisplayName(product)
  const linkedRows = await client.cosProcessKitProduct.findMany({
    where: {
      OR: [
        { productId: factoryProductId },
        { hardenerProductId: factoryProductId },
        { thinnerProductId: factoryProductId },
      ],
    },
    select: { kitId: true },
  })
  const affectedKitIds = [...new Set(linkedRows.map(row => row.kitId))]

  const [main, hardener, thinner] = await Promise.all([
    client.cosProcessKitProduct.updateMany({
      where: { productId: factoryProductId },
      data: { productName: displayName },
    }),
    client.cosProcessKitProduct.updateMany({
      where: { hardenerProductId: factoryProductId },
      data: { hardenerProductName: displayName },
    }),
    client.cosProcessKitProduct.updateMany({
      where: { thinnerProductId: factoryProductId },
      data: { thinnerProductName: displayName },
    }),
  ])

  if (affectedKitIds.length > 0) {
    await client.cosProcessKit.updateMany({
      where: { id: { in: affectedKitIds } },
      data: { updatedAt: new Date() },
    })
  }

  return {
    updatedCount: main.count + hardener.count + thinner.count,
    touchedKitCount: affectedKitIds.length,
  }
}

type ProcessKitProductNameFields = {
  productId: string
  productName: string
  hardenerProductId: string | null
  hardenerProductName: string | null
  thinnerProductId: string | null
  thinnerProductName: string | null
}

export function enrichProcessKitProductsWithLiveFactoryNames<
  T extends ProcessKitProductNameFields,
>(products: T[], nameById: ReadonlyMap<string, string>): T[] {
  return products.map(product => ({
    ...product,
    productName: nameById.get(product.productId) ?? product.productName,
    hardenerProductName: product.hardenerProductId
      ? (nameById.get(product.hardenerProductId) ?? product.hardenerProductName)
      : product.hardenerProductName,
    thinnerProductName: product.thinnerProductId
      ? (nameById.get(product.thinnerProductId) ?? product.thinnerProductName)
      : product.thinnerProductName,
  }))
}

export async function loadFactoryProductDisplayNameMap(
  productIds: (string | null | undefined)[],
  db?: DbClient,
) {
  const client = db ?? await getDbClient()
  const uniqueIds = [...new Set(productIds.filter((id): id is string => Boolean(id)))]
  if (uniqueIds.length === 0) return new Map<string, string>()

  const factoryProducts = await client.cosTableFactoryProduct.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, productCode: true, name: true },
  })

  return new Map(factoryProducts.map(product => [
    product.id,
    formatFactoryProductDisplayName(product),
  ]))
}

export async function enrichProcessKitProductsFromFactoryProducts<
  T extends ProcessKitProductNameFields,
>(products: T[], db?: DbClient) {
  const nameById = await loadFactoryProductDisplayNameMap(
    products.flatMap(product => [
      product.productId,
      product.hardenerProductId,
      product.thinnerProductId,
    ]),
    db,
  )
  return enrichProcessKitProductsWithLiveFactoryNames(products, nameById)
}
