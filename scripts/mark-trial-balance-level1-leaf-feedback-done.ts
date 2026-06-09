/**
 * Mark trial balance level-1 leaf-only display feedback as DONE.
 * Run: npx tsx scripts/mark-trial-balance-level1-leaf-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '试算平衡表只显示无子科目的一级项目' } },
      { title: { contains: '试算平衡表只显示' } },
      {
        pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/reports' },
        title: { contains: '试算平衡表' },
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
