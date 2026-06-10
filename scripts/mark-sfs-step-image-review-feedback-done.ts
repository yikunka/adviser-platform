/**
 * Mark SFS Orders production step image review workflow feedback as DONE.
 * Run: npx tsx scripts/mark-sfs-step-image-review-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: '生产步骤图片审批', mode: 'insensitive' } },
      { title: { contains: '生产步骤图片审批流程', mode: 'insensitive' } },
      { summary: { contains: '生产步骤图片审批', mode: 'insensitive' } },
      { summary: { contains: '只有 APPROVED 状态的图片才对客户可见', mode: 'insensitive' } },
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
