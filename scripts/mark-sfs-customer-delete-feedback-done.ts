/**
 * Mark SFS Customers delete feature feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-customer-delete-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: 'SFS Customers 页面增加客户删除', mode: 'insensitive' } },
      { title: { contains: 'SFS Customers', mode: 'insensitive' }, summary: { contains: '删除', mode: 'insensitive' } },
      { title: { contains: '客户删除', mode: 'insensitive' } },
      { summary: { contains: '删除客户功能', mode: 'insensitive' } },
      { pageUrl: { contains: 'sfs-customers', mode: 'insensitive' }, summary: { contains: '删除', mode: 'insensitive' } },
    ],
  },
  select: { id: true, title: true, status: true },
})

console.log('Found:', items)

for (const item of items) {
  if (item.status === 'DONE') {
    console.log('ALREADY DONE:', item.id, item.title)
    continue
  }
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', item.id, item.title)
}

console.log('Total processed:', items.length)
await prisma.$disconnect()
