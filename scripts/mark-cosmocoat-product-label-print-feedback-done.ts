/**
 * Mark "生产订单标签打印优化" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-product-label-print-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = '生产订单标签打印优化'
const PAGE_URL = '/zh/admin/cosmocoat-production-orders'

async function main() {
  const matches = await prisma.featureRequest.findMany({
    where: {
      OR: [
        { title: TITLE },
        { title: { contains: '生产订单标签打印优化' } },
        { title: { contains: '生产单标签打印优化' } },
        {
          AND: [
            { pageUrl: { contains: 'cosmocoat-production-orders' } },
            { summary: { contains: '产品标签' } },
            { summary: { contains: '产品编号' } },
          ],
        },
      ],
    },
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: 'desc' },
  })

  const match = matches[0]

  if (!match) {
    const created = await prisma.featureRequest.create({
      data: {
        title: TITLE,
        summary:
          'CosmoCoat 生产订单列表页的产品标签打印功能调整：移除“产品标签”文字并改用产品编号显示；配方相关文字缩小；打印视觉改为纯黑白设计以适配热敏纸；标签尺寸保持 100mm x 70mm。',
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
