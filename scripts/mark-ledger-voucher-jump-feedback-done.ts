/**
 * Mark General Ledger voucher jump-to-journal feedback as DONE.
 * Run: npx tsx scripts/mark-ledger-voucher-jump-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const items = await prisma.featureRequest.findMany({
  where: {
    status: { not: 'DONE' },
    OR: [
      { title: { contains: '總分類帳憑證號增加跳轉按鈕' } },
      { title: { contains: '总分类账凭证号增加跳转按钮' } },
      { title: { contains: '憑證號增加跳轉' } },
      { title: { contains: '凭证号增加跳转' } },
      {
        AND: [
          { title: { contains: '总分类' } },
          { title: { contains: '凭证' } },
          { title: { contains: '跳转' } },
        ],
      },
      {
        AND: [
          { summary: { contains: '凭证号' } },
          { summary: { contains: '跳转' } },
          { pageUrl: { contains: '/ledger' } },
        ],
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
