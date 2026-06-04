/**
 * Mark "财务报表移除货币符号" feedback as DONE.
 * Run: npx tsx scripts/mark-financial-reports-no-currency-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '财务报表移除货币符号' } },
      { summary: { contains: '完全不显示任何货币符号' } },
      { pageUrl: { contains: '/admin/financial/cmpuo63sq001a3iw5bwz5xlg4/reports' } },
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
