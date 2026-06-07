/**
 * Mark "配方详情成品物料显示实时工厂产品单价" feedback as DONE.
 * Run: npx tsx scripts/mark-recipe-factory-product-live-price-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '配方详情成品物料显示实时工厂产品单价' } },
      { title: { contains: '成品物料显示实时工厂产品单价' } },
      { summary: { contains: 'cos_factory_products.unit_price' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmq0whqu4001vlow5wtzwt0gz' } },
    ],
  },
})

for (const item of items) {
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', item.id, item.title)
}

console.log('Total updated:', items.length)
await prisma.$disconnect()
