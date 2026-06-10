/**
 * Mark General Ledger cascading account selector garbled-label feedback as DONE.
 * Run: npx tsx scripts/mark-ledger-cascade-garbled-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const REQUEST = {
  title: '總分類帳科目選擇器三級聯動顯示亂碼問題',
  summary:
    '在會計模組總分類帳頁面的三級科目選擇器中，修正選擇一級科目後二級和三級科目顯示 raw value / 內部 id 而非正常科目名稱的問題；中英文環境下均顯示用戶可讀的 code - name 文本。',
  pageUrl: '/zh/admin/financial/cmpuo422m00163iw5o0isz8e1/ledger',
  pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
  priority: 'medium',
  userEmail: 'admin@6amadvise.com',
  userName: '6AM Admin',
} as const

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      status: { not: 'DONE' },
      OR: [
        { title: { contains: '總分類帳科目選擇器三級聯動顯示亂碼問題' } },
        { title: { contains: '总分类账科目选择器三级联动显示乱码问题' } },
        {
          AND: [
            { pageUrl: { contains: '/ledger' } },
            { summary: { contains: '三級' } },
            { summary: { contains: '亂碼' } },
          ],
        },
        {
          AND: [
            { pageUrl: { contains: '/ledger' } },
            { summary: { contains: '三级' } },
            { summary: { contains: '乱码' } },
          ],
        },
      ],
    },
    select: { id: true, title: true },
  })

  for (const item of items) {
    await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    console.log('DONE:', item.id, item.title)
  }

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        ...REQUEST,
        conversation: [],
        attachments: [],
        status: 'DONE',
      },
      select: { id: true, title: true },
    })
    console.log('CREATED DONE:', created.id, created.title)
  }

  console.log('Total changed:', items.length === 0 ? 1 : items.length)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
