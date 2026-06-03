/**
 * Mark Jun 2026 CosmoCoat feedback items as DONE.
 * Run: npx tsx scripts/mark-jun-2026-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const titles = [
  '移除调色配方待选物料的参考配方下拉筛选',
  '生产单详情"本次实投"数据无法保存',
  'CosmoCoat 工厂产品黏度字段改为手动输入',
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
