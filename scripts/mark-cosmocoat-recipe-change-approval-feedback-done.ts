/**
 * Mark CosmoCoat recipe delete/modify super-admin approval feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-recipe-change-approval-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: 'CosmoCoat配方删除修改超级管理员审批流程', mode: 'insensitive' } },
      { title: { contains: '配方删除修改超级管理员审批', mode: 'insensitive' } },
      { summary: { contains: '配方变更受控', mode: 'insensitive' } },
      {
        pageUrl: { contains: 'cosmocoat-recipes', mode: 'insensitive' },
        summary: { contains: '审批', mode: 'insensitive' },
      },
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
