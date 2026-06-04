/**
 * Mark "原料详情基本信息字段名修改" feedback as DONE.
 * Run: npx tsx scripts/mark-raw-material-cas-label-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '原料详情基本信息字段名修改' } },
      { pageUrl: { contains: 'cosmocoat-raw-materials/cmpjt2g2m00qoqfw5ju9vekvt' } },
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
