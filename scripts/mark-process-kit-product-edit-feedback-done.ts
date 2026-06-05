/**
 * Mark "工艺产品列表添加修改功能" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-product-edit-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '工艺产品列表添加修改功能' } },
      { title: { contains: '工艺产品列表' } },
      { pageUrl: { contains: 'cosmocoat-process-kits/new' } },
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
