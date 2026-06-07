/**
 * Mark SFS Customer Internal Order Code feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-customer-internal-order-code-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: 'Internal Order Code', mode: 'insensitive' } },
      { title: { contains: 'internal order code', mode: 'insensitive' } },
      { summary: { contains: 'internal order code', mode: 'insensitive' } },
      { summary: { contains: 'Internal Order Code', mode: 'insensitive' } },
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
