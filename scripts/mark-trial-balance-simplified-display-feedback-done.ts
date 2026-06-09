/**
 * Mark trial balance simplified display feedback as DONE.
 * Run: npx tsx scripts/mark-trial-balance-simplified-display-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '試算平衡表簡化顯示' } },
      { title: { contains: '试算平衡表简化显示' } },
      {
        pageUrl: { contains: '/admin/financial/cmpkppbnh0u0lqfw5350jraae/reports' },
        title: { contains: '試算平衡表' },
      },
      {
        pageUrl: { contains: '/admin/financial/cmpkppbnh0u0lqfw5350jraae/reports' },
        title: { contains: '试算平衡表' },
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
