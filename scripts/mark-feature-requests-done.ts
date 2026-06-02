/**
 * One-off: mark CosmoCoat feedback items as DONE after implementation.
 * Run: npx tsx scripts/mark-feature-requests-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '調適配色號預覽色塊放大' } },
      { title: { contains: '预览色块' } },
      { pageUrl: { contains: 'cosmocoat-color-formulas/new' } },
      { title: { contains: '配方详情页打印功能空白' } },
      { title: { contains: '打印功能空白' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpp2cp4l0t74hcw5ta2tqnqw' } },
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
