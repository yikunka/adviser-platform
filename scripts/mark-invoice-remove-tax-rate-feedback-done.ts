/**
 * Mark "发票创建表单移除税率字段" feedback as DONE.
 * Run: npx tsx scripts/mark-invoice-remove-tax-rate-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '发票创建表单移除税率字段' } },
      {
        AND: [
          { title: { contains: '发票' } },
          { title: { contains: '税率' } },
        ],
      },
      { pageUrl: { contains: '/admin/invoices/new' } },
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
