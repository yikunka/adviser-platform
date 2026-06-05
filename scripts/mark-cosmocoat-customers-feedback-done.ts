/**
 * Mark "CosmoCoat 平台客户管理功能" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-customers-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat 平台客户管理' } },
      { title: { contains: '客户管理功能' } },
      { pageUrl: { contains: 'cosmocoat-process-kits/cmq0etshz000r06w5uw853gio' } },
      { id: 'cmq0etshz000r06w5uw853gio' },
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
