/**
 * Mark journal list level-3 account hierarchy feedback as DONE.
 * Run: npx tsx scripts/mark-journal-level3-hierarchy-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '日记账列表页三级科目显示问题' } },
      { title: { contains: '三级科目显示' } },
      {
        AND: [
          { title: { contains: '日记账' } },
          { title: { contains: '三级科目' } },
        ],
      },
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
