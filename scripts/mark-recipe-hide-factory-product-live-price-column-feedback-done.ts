/**
 * Mark "配方物料列表隐藏工厂产品单价(实时)列" feedback as DONE.
 * Run: npx tsx scripts/mark-recipe-hide-factory-product-live-price-column-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '配方物料列表隐藏工厂产品单价' } },
      { title: { contains: '隐藏工厂产品单价(实时)列' } },
      { summary: { contains: '工厂产品单价(实时)' } },
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
