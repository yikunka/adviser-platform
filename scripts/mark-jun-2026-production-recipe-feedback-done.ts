/**
 * Mark Jun 2026 production-order and recipe viscosity feedback as DONE.
 * Run: npx tsx scripts/mark-jun-2026-production-recipe-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const titles = [
  '生产单配方物料显示不完整Bug',
  '配方详情页新增产品黏度字段',
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
