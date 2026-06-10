/**
 * Mark "调色配方编号从-5001起新增" feedback as DONE.
 * Run: npx tsx scripts/mark-color-formula-code-5001-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '调色配方编号从-5001起新增' } },
      { pageUrl: { contains: 'cosmocoat-color-formulas/cmq7hmcw90t6b16w5hyof63on' } },
      { id: 'cmq7hmcw90t6b16w5hyof63on' },
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
