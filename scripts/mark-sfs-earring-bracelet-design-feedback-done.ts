/**
 * Mark SFS Diamond Earring/Bracelet Design feedback items as DONE.
 * Run: npx tsx scripts/mark-sfs-earring-bracelet-design-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: '手链设计', mode: 'insensitive' } },
      { title: { contains: 'Bracelet Design', mode: 'insensitive' } },
      { title: { contains: 'Earring Design', mode: 'insensitive' } },
      { title: { contains: '耳饰设计', mode: 'insensitive' } },
      {
        title: { contains: 'SFS Diamond Specs', mode: 'insensitive' },
        summary: { contains: 'Bracelet', mode: 'insensitive' },
      },
      {
        title: { contains: 'SFS Diamond', mode: 'insensitive' },
        summary: { contains: '手链', mode: 'insensitive' },
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
