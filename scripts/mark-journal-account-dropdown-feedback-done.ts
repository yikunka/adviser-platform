/**
 * Mark journal account dropdown text-color feedback as DONE.
 * Run: npx tsx scripts/mark-journal-account-dropdown-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '日记账科目下拉菜单文字颜色' } },
      { title: { contains: '科目下拉菜单文字颜色' } },
      {
        AND: [
          { title: { contains: '日记账' } },
          { title: { contains: '科目' } },
          { title: { contains: '下拉' } },
        ],
      },
      { pageUrl: { contains: '/admin/financial/cmpkppbnh0u0lqfw5350jraae/journal' } },
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
