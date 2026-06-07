/**
 * Mark SFS Package Received / contract upload / production step feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-package-contract-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: 'Package Received', mode: 'insensitive' } },
      { title: { contains: '合同上传', mode: 'insensitive' } },
      { title: { contains: 'SFS Customers - 合同上传', mode: 'insensitive' } },
      { title: { contains: 'SFS订单生产阶段新增', mode: 'insensitive' } },
      { summary: { contains: 'Package Received', mode: 'insensitive' } },
      { summary: { contains: '合同上传', mode: 'insensitive' } },
      { summary: { contains: 'SFS订单生产阶段新增', mode: 'insensitive' } },
    ],
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
