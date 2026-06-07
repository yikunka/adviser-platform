/**
 * Mark "工艺配套书性能测试新增盐雾选项" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-salt-spray-options-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '工艺配套书性能测试新增盐雾选项' } },
      { title: { contains: '性能测试新增盐雾选项' } },
      { summary: { contains: '65°C/85%RH 48H' } },
      { summary: { contains: '5% NaCl盐雾48H' } },
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
