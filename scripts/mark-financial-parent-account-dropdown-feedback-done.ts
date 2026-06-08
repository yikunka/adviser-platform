/**
 * Mark financial parent-account dropdown garbled-text feedback as DONE.
 * Run: npx tsx scripts/mark-financial-parent-account-dropdown-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '上级科目下拉框显示乱码' } },
      { title: { contains: '财务科目 - 编辑/新建时上级科目下拉框显示乱码' } },
      {
        AND: [
          { title: { contains: '财务科目' } },
          { title: { contains: '上级科目' } },
        ],
      },
      {
        AND: [
          { title: { contains: '会计科目' } },
          { title: { contains: '乱码' } },
        ],
      },
      { pageUrl: { contains: '/admin/financial/cmpup2cxv0008fsw5knhu8mm5/accounts' } },
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
