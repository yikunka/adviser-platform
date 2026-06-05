/**
 * Mark "SFS发票页面添加发票号码显示" feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-invoice-number-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'SFS发票页面添加发票号码显示' } },
      {
        AND: [
          { title: { contains: 'SFS' } },
          { title: { contains: '发票号码' } },
        ],
      },
      { pageUrl: { contains: '/admin/sfs-invoices/new' } },
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
