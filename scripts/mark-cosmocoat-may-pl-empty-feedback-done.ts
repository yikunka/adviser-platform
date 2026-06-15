/**
 * Mark "检查CosmoCoat 2026年5月损益表无数据显示原因" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-may-pl-empty-feedback-done.ts
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
        { title: { contains: '检查CosmoCoat 2026年5月损益表无数据显示原因' } },
        { title: { contains: 'CosmoCoat 2026年5月损益表无数据显示原因' } },
        { title: { contains: 'CosmoCoat 财务报表损益表借贷数据为空' } },
        {
          pageUrl: { contains: '/admin/financial/cmpuo422m00163iw5o0isz8e1/reports' },
          summary: { contains: '2026年5月' },
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
