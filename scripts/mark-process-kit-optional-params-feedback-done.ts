/**
 * Mark "工艺书流程参数字段改为非必填" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-optional-params-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '工艺书流程参数字段改为非必填' } },
      { title: { contains: '工艺书流程参数' } },
      { pageUrl: { contains: 'cmq3myy4d0thbqjw5yceama73' } },
      { id: 'cmq3myy4d0thbqjw5yceama73' },
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
