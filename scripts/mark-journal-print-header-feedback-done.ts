/**
 * Mark journal print header removal feedback as DONE.
 * Run: npx tsx scripts/mark-journal-print-header-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '移除日记账打印的页首' } },
      { title: { contains: '移除日记账打印的页眉' } },
      {
        AND: [
          { title: { contains: '日记账' } },
          { title: { contains: '打印' } },
          { OR: [{ title: { contains: '页首' } }, { title: { contains: '页眉' } }] },
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
