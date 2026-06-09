/**
 * Mark trial balance level filter and balance sheet level-1 expandable feedback as DONE.
 * Run: npx tsx scripts/mark-financial-reports-level-filter-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '试算平衡表支持按科目层级筛选查看' } },
      { title: { contains: '资产负债表只显示一级科目汇总' } },
      {
        pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/reports' },
        title: { contains: '试算平衡表' },
        summary: { contains: '科目层级' },
      },
      {
        pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/reports' },
        title: { contains: '资产负债表' },
        summary: { contains: '一级科目' },
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
