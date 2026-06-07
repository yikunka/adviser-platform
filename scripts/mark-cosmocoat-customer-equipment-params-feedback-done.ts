/**
 * Mark "CosmoCoat新客戶頁面增加生產設備參數欄位" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-customer-equipment-params-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat新客戶頁面增加生產設備參數欄位' } },
      { title: { contains: '生產設備參數' } },
      { title: { contains: '生产设备参数' } },
      { pageUrl: { contains: 'cosmocoat-customers/new' } },
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
