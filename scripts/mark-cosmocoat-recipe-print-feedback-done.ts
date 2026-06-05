/**
 * Mark recipe production-requirements split and color-formula print feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-recipe-print-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '配方详情页生产要求拆分字段' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpjts11i00vpqfw5uxp94fql' } },
      { title: { contains: '調色配方詳情打印檔移除生產說明段落' } },
      { title: { contains: '调色配方详情打印档移除生产说明段落' } },
      { pageUrl: { contains: 'cosmocoat-color-formulas/cmpxoq5mm003glqw5jvxxc4yg' } },
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
