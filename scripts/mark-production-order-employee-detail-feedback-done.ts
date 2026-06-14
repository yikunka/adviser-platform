/**
 * One-off: mark "生产单详情页移除生产人员信息展示" feedback as DONE.
 * Run: npx tsx scripts/mark-production-order-employee-detail-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '生产单详情页移除生产人员信息展示' } },
      { title: { contains: '移除生产人员信息展示' } },
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
