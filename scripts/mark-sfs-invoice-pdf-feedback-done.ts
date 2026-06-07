/**
 * Mark SFS invoice PDF / SFS order image feedback items as DONE.
 * Run: npx tsx scripts/mark-sfs-invoice-pdf-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const titlePatterns = [
  'SFS发票PDF增加银行收款资料',
  'SFS Invoice PDF: Add Fixed Company Address',
  'SFS发票PDF公司抬头更名',
  'SFS订单图片显示放大',
]

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: titlePatterns.map(title => ({ title: { contains: title } })),
  },
  select: { id: true, title: true, status: true },
})

console.log('Found:', items)

for (const item of items) {
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', item.id, item.title)
}

console.log('Total updated:', items.length)
await prisma.$disconnect()
