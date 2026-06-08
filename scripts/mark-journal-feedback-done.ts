/**
 * Mark journal feedback items (Jun 2026) as DONE.
 * Run: npx tsx scripts/mark-journal-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const titles = [
  '会计凭证批量过账功能',
  '日记账科目自动提示功能',
  '日记账日期默认值改为上条分录日期',
  '日记账编辑页面增加键盘快捷键导航与保存功能',
]

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: titles.map(title => ({ title: { contains: title } })),
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
