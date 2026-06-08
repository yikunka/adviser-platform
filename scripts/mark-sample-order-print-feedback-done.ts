/**
 * Mark "CosmoCoat 打样单添加打印功能" feedback as DONE.
 * Run: npx tsx scripts/mark-sample-order-print-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '打样单添加打印功能' } },
      { AND: [{ title: { contains: '打样单' } }, { title: { contains: '打印' } }] },
      { AND: [{ summary: { contains: '打样单' } }, { summary: { contains: '打印' } }] },
      { pageUrl: { contains: 'cosmocoat-sample-orders/cmq5dh9j50009vew5yzttxw93' } },
      { id: 'cmq5dh9j50009vew5yzttxw93' },
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
