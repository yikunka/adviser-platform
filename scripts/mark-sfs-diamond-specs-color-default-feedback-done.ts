/**
 * Mark SFS Diamond Specs default Color category feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-diamond-specs-color-default-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: 'SFS Diamond Specs 页面默认显示 Color', mode: 'insensitive' } },
      { title: { contains: '默认显示 Color', mode: 'insensitive' } },
      { title: { contains: 'default Color', mode: 'insensitive' } },
      {
        title: { contains: 'SFS Diamond Specs', mode: 'insensitive' },
        summary: { contains: 'Color', mode: 'insensitive' },
      },
      {
        pageUrl: { contains: 'sfs-diamond-specs', mode: 'insensitive' },
        summary: { contains: 'Color', mode: 'insensitive' },
      },
    ],
  },
  select: { id: true, title: true, status: true },
})

console.log('Found:', items)

for (const item of items) {
  if (item.status === 'DONE') {
    console.log('ALREADY DONE:', item.id, item.title)
    continue
  }
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', item.id, item.title)
}

console.log('Total processed:', items.length)
await prisma.$disconnect()
