/**
 * Mark recipe finished-product picker price sync feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-recipe-finished-product-price-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '配方待选成品价格' } },
      { title: { contains: '待选成品价格未实时同步' } },
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
