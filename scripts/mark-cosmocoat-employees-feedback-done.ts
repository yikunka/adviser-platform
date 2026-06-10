/**
 * Mark "CosmoCoat平台员工管理功能" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-employees-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat平台员工管理' } },
      { title: { contains: '员工管理功能' } },
      { title: { contains: '员工管理' } },
      { pageUrl: { contains: 'cosmocoat-employees' } },
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
