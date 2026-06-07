/**
 * Mark "打样单工藝書明細顯示材料清單" feedback as DONE.
 * Run: npx tsx scripts/mark-sample-order-process-kit-materials-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '打样单工藝書明細顯示材料清單' } },
      { title: { contains: '打样单工艺书明细显示材料清单' } },
      { title: { contains: '工藝書明細顯示材料' } },
      { summary: { contains: '完整工艺流程文档' } },
      { summary: { contains: '材料清单' } },
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
