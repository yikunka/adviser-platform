/**
 * Mark production order detail UI feedback items as DONE:
 * - 生产单详情页移除查看配方按钮
 * - 生产订单详情页移除生产批次字段
 * Run: npx tsx scripts/mark-production-order-detail-ui-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const FEEDBACK_ITEMS = [
  {
    id: 'manual-production-order-remove-view-recipe-btn-20260608',
    title: '生产单详情页移除查看配方按钮',
    summary:
      '在 CosmoCoat 生产订单详情页中，配方名称字段旁边的「查看配方」按钮需要被取消/移除。该修改仅影响生产订单详情页的 UI，不破坏配方信息展示或其他功能。',
  },
  {
    id: 'manual-production-order-remove-batch-field-20260608',
    title: '生产订单详情页移除生产批次字段',
    summary:
      '在 CosmoCoat 生产订单详情页 (路径 /admin/cosmocoat-production-orders/[id]) 中取消显示"生产批次"(batch number) 字段，仅保留订单代码、工厂产品、配方、总重量等必要信息。',
  },
] as const

const PAGE_URL = '/zh/admin/cosmocoat-production-orders/cmq3x23gg000jp3w59lbe5522'
const PAGE_TITLE = '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services'

async function main() {
  let updatedCount = 0

  for (const item of FEEDBACK_ITEMS) {
    const existing = await prisma.featureRequest.findMany({
      where: { title: item.title },
      select: { id: true, title: true, status: true },
    })

    const match = existing[0]

    if (!match) {
      const created = await prisma.featureRequest.create({
        data: {
          id: item.id,
          title: item.title,
          summary: item.summary,
          priority: 'medium',
          pageUrl: PAGE_URL,
          pageTitle: PAGE_TITLE,
          conversation: [],
          attachments: [],
          status: 'DONE',
          userEmail: 'admin@6amadvise.com',
          userName: '6AM Admin',
        },
        select: { id: true, title: true },
      })
      console.log('CREATED DONE:', created.id, created.title)
      updatedCount += 1
      continue
    }

    if (match.status === 'DONE') {
      console.log('ALREADY DONE:', match.id, match.title)
      continue
    }

    await prisma.featureRequest.update({
      where: { id: match.id },
      data: { status: 'DONE' },
    })
    updatedCount += 1
    console.log('DONE:', match.id, match.title)
  }

  console.log('Total updated:', updatedCount)
}

main().finally(async () => {
  await prisma.$disconnect()
})
