/**
 * Mark General Ledger account-code quick search feedback as DONE.
 * Run: npx tsx scripts/mark-ledger-account-code-search-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '总分类帐科目号快速搜索' } },
      { title: { contains: '总分类账科目号快速搜索' } },
      { title: { contains: '科目号快速搜索' } },
      {
        AND: [
          { title: { contains: '总分类' } },
          { title: { contains: '科目号' } },
        ],
      },
      {
        AND: [
          { summary: { contains: '科目号' } },
          { pageUrl: { contains: '/ledger' } },
        ],
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
await prisma.$disconnect()
