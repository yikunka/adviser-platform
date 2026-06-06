/**
 * Mark "Process Kits 性能测试新增组合选项" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-humidity-salt-spray-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'Process Kits 性能测试新增组合选项' } },
      { title: { contains: '性能测试新增组合选项' } },
      { summary: { contains: '高温高湿/盐雾' } },
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
