/**
 * Mark "客户管理保存按钮位置调整" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-customer-save-button-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '客户管理保存按钮位置调整' } },
      { title: { contains: '保存按钮位置' } },
      { pageUrl: { contains: 'cosmocoat-customers/cmqbyzw7g00bpcsw5ot3r9lfv' } },
      { id: 'cmqbyzw7g00bpcsw5ot3r9lfv' },
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
