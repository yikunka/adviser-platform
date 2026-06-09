/**
 * Mark financial account-type and default chart feedback as DONE.
 * Run: npx tsx scripts/mark-financial-account-types-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '长期资产' } },
      { title: { contains: '长期负债' } },
      { title: { contains: '新增科目类型' } },
      { title: { contains: 'Pre-set standard chart of accounts' } },
      { title: { contains: 'standard chart of accounts' } },
      {
        AND: [
          { title: { contains: '科目类型' } },
          { title: { contains: '长期' } },
        ],
      },
      { pageUrl: { contains: '/admin/financial/cmpkppbnh0u0lqfw5350jraae/accounts' } },
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
