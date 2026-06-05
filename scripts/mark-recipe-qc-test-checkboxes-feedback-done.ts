/**
 * Mark recipe QC test checkbox feedback as DONE.
 * Run: npx tsx scripts/mark-recipe-qc-test-checkboxes-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'QC测试标准复选框' } },
      { title: { contains: 'QC测试标准复选框功能' } },
      { pageUrl: { contains: 'cosmocoat-recipes/cmpjts11i00vpqfw5uxp94fql' } },
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
