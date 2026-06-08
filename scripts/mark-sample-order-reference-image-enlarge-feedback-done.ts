/**
 * Mark "CosmoCoat打样单参考样品图片放大显示" feedback as DONE.
 * Run: npx tsx scripts/mark-sample-order-reference-image-enlarge-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat打样单参考样品图片放大显示' } },
      { title: { contains: '打样单参考样品图片放大显示' } },
      { summary: { contains: '参考样品图片（reference sample image）的显示尺寸放大4倍' } },
      { summary: { contains: '使其在所有状态下都能以放大后的尺寸展示' } },
      { pageUrl: { contains: 'cosmocoat-sample-orders/cmq5dh9j50009vew5yzttxw93' } },
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
