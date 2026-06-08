/**
 * Mark "工藝書性能測試標準顯示語言與英文版不一致" feedback as DONE.
 * Run: npx tsx scripts/mark-sample-order-performance-standards-label-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '工藝書性能測試標準顯示語言與英文版不一致' } },
      { title: { contains: '工艺书性能测试标准显示语言与英文版不一致' } },
      { title: { contains: '性能測試標準顯示語言' } },
      { summary: { contains: '性能测试标准为英文格式' } },
      { summary: { contains: '与工艺书（Process Kits）模块中显示的中文选项不一致' } },
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
