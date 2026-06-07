/**
 * Mark sample-order feedback items as DONE:
 * - 打樣單僅可關聯單一工藝套件
 * - 打样单新增参考样品图片上传功能
 * Run: npx tsx scripts/mark-sample-order-kit-image-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '打樣單僅可關聯單一工藝套件' } },
      { title: { contains: '打样单仅可关联单一工艺套件' } },
      { title: { contains: '打样单新增参考样品图片上传功能' } },
      { title: { contains: '参考样品图片' } },
      { summary: { contains: '只能关联一个工艺套件' } },
      { summary: { contains: '参考样品图片' } },
      { pageUrl: { contains: 'cosmocoat-sample-orders/new' } },
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
