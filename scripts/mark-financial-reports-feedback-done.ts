/**
 * Mark financial reports feedback items (Jun 2026) as DONE.
 * Run: npx tsx scripts/mark-financial-reports-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const titles = [
  '资产负债表按HKFRS重新分类显示',
  '试算平衡表部分一级科目缺失显示',
  '试算平衡表科目数据实时刷新',
]

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: titles.map(title => ({ title: { contains: title } })),
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
