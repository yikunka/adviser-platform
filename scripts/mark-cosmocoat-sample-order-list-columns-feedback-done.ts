/**
 * Mark "CosmoCoat 打样单列表字段优化" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-sample-order-list-columns-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const PAGE_URL = '/zh/admin/cosmocoat-sample-orders'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
})

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      OR: [
        { title: { contains: 'CosmoCoat 打样单列表字段优化' } },
        {
          AND: [
            { title: { contains: '打样单列表' } },
            { title: { contains: '字段优化' } },
          ],
        },
        {
          AND: [
            { summary: { contains: '特急' } },
            { summary: { contains: 'process kit count' } },
          ],
        },
        {
          AND: [
            { pageUrl: { contains: PAGE_URL } },
            { summary: { contains: '参考样品缩略图' } },
          ],
        },
      ],
    },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-cosmocoat-sample-order-list-columns-20260614',
        title: 'CosmoCoat 打样单列表字段优化',
        summary:
          '在 /admin/cosmocoat-sample-orders 列表中移除参考样品缩略图、工艺书数目、调色配方数目和总公斤数字段，新增特急标识列，特急订单以红色文字显示。',
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

  for (const item of items) {
    if (item.status === 'DONE') {
      console.log('ALREADY DONE:', item.id, item.title)
      continue
    }

    await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    console.log('DONE:', item.id, item.title)
  }

  console.log('Total updated:', items.length)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
