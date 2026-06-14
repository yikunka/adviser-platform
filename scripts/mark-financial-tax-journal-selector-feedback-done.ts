/**
 * Mark financial receivables / journal / selector feedback items as DONE.
 * Run: npx tsx scripts/mark-financial-tax-journal-selector-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const titles = [
  '应收管理销售发票页面增加税率快捷按钮',
  '调大日记账分录明细输入区域尺寸',
  '财务管理公司选择器显示财务负责人',
]

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    title: { in: titles },
  },
  select: { id: true, number: true, title: true },
})

for (const item of items) {
  await prisma.featureRequest.update({
    where: { id: item.id },
    data: { status: 'DONE' },
  })
  console.log(`DONE #${item.number}: ${item.title}`)
}

const missing = titles.filter(title => !items.some(item => item.title === title))
if (missing.length > 0) {
  console.log('Not found or already DONE:', missing.join(', '))
}

console.log('Total updated:', items.length)
await prisma.$disconnect()
