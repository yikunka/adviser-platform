/**
 * Mark the "损益表按期间发生额统计" feedback item as DONE.
 * Run: npx tsx scripts/mark-financial-pl-period-movement-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      status: { not: 'DONE' },
      OR: [
        { title: { contains: '損益表按期間發生額統計' } },
        { title: { contains: '损益表按期间发生额统计' } },
        {
          pageUrl: { contains: '/admin/financial/cmpuo422m00163iw5o0isz8e1/reports' },
          summary: { contains: '損益表' },
        },
        {
          pageUrl: { contains: '/admin/financial/cmpuo422m00163iw5o0isz8e1/reports' },
          summary: { contains: '损益表' },
        },
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
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
