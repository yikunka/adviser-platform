/**
 * Mark SFS "Package arrived production site" production step feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-package-arrived-production-site-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: 'Package arrived production site', mode: 'insensitive' } },
      { title: { contains: 'SFS Orders 生产流程新增步骤', mode: 'insensitive' } },
      { summary: { contains: 'Package arrived production site', mode: 'insensitive' } },
      { summary: { contains: '生产流程新增步骤', mode: 'insensitive' } },
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
