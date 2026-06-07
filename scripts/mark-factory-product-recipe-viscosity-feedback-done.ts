/**
 * Mark "工厂产品黏度自动关联配方黏度" feedback as DONE.
 * Run: npx tsx scripts/mark-factory-product-recipe-viscosity-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '工厂产品黏度自动关联配方黏度' } },
      { pageUrl: { contains: 'cosmocoat-factory-products' } },
    ],
  },
})

const matched = items.filter(item => item.title.includes('工厂产品黏度自动关联配方黏度'))

for (const item of matched) {
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', item.id, item.title)
}

console.log('Total updated:', matched.length)
await prisma.$disconnect()
