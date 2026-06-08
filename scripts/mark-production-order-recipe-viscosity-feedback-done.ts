/**
 * Mark "生產訂單詳情顯示配方黏度" feedback as DONE.
 * Run: npx tsx scripts/mark-production-order-recipe-viscosity-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = '生產訂單詳情顯示配方黏度'
const PAGE_URL = '/zh/admin/cosmocoat-production-orders/cmq5cq6fu00013bw5eudd7rny'

async function main() {
  const existing = await prisma.featureRequest.findMany({
    where: {
      OR: [
        { title: TITLE },
        { title: { contains: '生產訂單詳情顯示配方黏度' } },
        { pageUrl: { contains: 'cosmocoat-production-orders/cmq5cq6fu00013bw5eudd7rny' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  const match = existing.find(item => item.title.includes('配方黏度') || item.title === TITLE) ?? existing[0]

  if (!match) {
    const created = await prisma.featureRequest.create({
      data: {
        title: TITLE,
        summary:
          '在 CosmoCoat 生產訂單詳情頁面 /admin/cosmocoat-production-orders/[id] 的基本信息區域，添加顯示該訂單所關聯配方的黏度資訊（如 9.7-9.8 S/KU），方便生產人員快速確認產品技術參數。',
        priority: 'medium',
        pageUrl: PAGE_URL,
        pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
        conversation: [],
        attachments: [],
        status: 'DONE',
        userEmail: 'admin@6amadvise.com',
        userName: '6AM Admin',
      },
      select: { id: true, title: true },
    })
    console.log('CREATED DONE:', created.id, created.title)
    return
  }

  if (match.status === 'DONE') {
    console.log('ALREADY DONE:', match.id, match.title)
    return
  }

  await prisma.featureRequest.update({
    where: { id: match.id },
    data: { status: 'DONE' },
  })
  console.log('DONE:', match.id, match.title)
}

main().finally(async () => {
  await prisma.$disconnect()
})
