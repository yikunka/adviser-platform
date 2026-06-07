/**
 * Mark color-formula 实投 print column & hide target-color feedback as DONE.
 * Run: npx tsx scripts/mark-color-formula-shitou-target-color-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '調色單打印文件增加「實投」欄位' } },
      { title: { contains: '调色单打印文件增加「实投」字段' } },
      { title: { contains: '調色配方隱藏目標色字段' } },
      { title: { contains: '调色配方隐藏目标色字段' } },
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
