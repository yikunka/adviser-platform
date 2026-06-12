/**
 * Mark "CosmoCoat客户管理-上传营业执照功能" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-customer-business-license-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat客户管理-上传营业执照' } },
      { title: { contains: '上传营业执照功能' } },
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
