/**
 * Mark "SFS发票明细添加重量列" feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-invoice-weight-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { id: 'cmq3lecm50tgyqjw5zjsfc8q2' },
      { title: { contains: 'SFS发票明细添加重量列' } },
      {
        AND: [
          { title: { contains: 'SFS' } },
          { title: { contains: '重量' } },
        ],
      },
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
