/**
 * Mark "工藝書性能測試新增耐醇及耐MEK選項" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-chemical-resistance-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '工藝書性能測試新增耐醇及耐MEK選項' } },
      { title: { contains: '工艺书性能测试新增耐醇及耐MEK选项' } },
      { summary: { contains: '耐醇 99%/50' } },
      { summary: { contains: '耐 MEK/50' } },
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
