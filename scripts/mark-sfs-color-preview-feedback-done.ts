/**
 * Mark SFS Diamond color preview feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-color-preview-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: '订单页面展示钻石颜色预览图', mode: 'insensitive' } },
      { title: { contains: '钻石颜色预览', mode: 'insensitive' } },
      { title: { contains: 'color preview', mode: 'insensitive' } },
      { summary: { contains: '颜色预览', mode: 'insensitive' } },
      { summary: { contains: 'sfs-diamond-specs', mode: 'insensitive' } },
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
