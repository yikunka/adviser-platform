/**
 * Mark level-1 leaf account direct entry feedback as DONE.
 * Run: npx tsx scripts/mark-level1-leaf-entry-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '允许一级科目在无二级科目时直接录入数据' } },
      { title: { contains: '一级科目在无二级科目' } },
      { title: { contains: '无二级科目时直接录入' } },
      {
        pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/reports' },
        title: { contains: '一级科目' },
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
