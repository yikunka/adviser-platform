/**
 * Mark balance sheet level-1-only display feedback as DONE.
 * Run: npx tsx scripts/mark-balance-sheet-level1-only-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '资产负债表仅显示一级科目' } },
      {
        pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/reports' },
        title: { contains: '资产负债表' },
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
