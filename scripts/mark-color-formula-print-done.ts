/**
 * Mark "调色配方打印功能优化" feedback as DONE.
 * Run: npx tsx scripts/mark-color-formula-print-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '调色配方打印功能优化' } },
      { pageUrl: { contains: 'cosmocoat-color-formulas/cmpxgcv320004g5w5co61eb51' } },
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
