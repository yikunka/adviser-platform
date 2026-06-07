/**
 * Mark "生产订单配方物料应完整加载原料和半成品" feedback as DONE.
 * Run: npx tsx scripts/mark-production-order-recipe-materials-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      OR: [
        { title: { contains: '生产订单配方物料应完整加载原料和半成品' } },
        { title: { contains: '生产订单配方物料' } },
        { summary: { contains: 'component recipes' } },
        { summary: { contains: '半成品组件' } },
        { pageUrl: { contains: 'cosmocoat-production-orders/new' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-production-order-recipe-materials-20260607',
        title: '生产订单配方物料应完整加载原料和半成品',
        summary:
          'CosmoCoat 生产订单页面选择产品或打开现有订单时，应完整同步配方的原材料、半成品配方组件和 Sol 半成品库存到物料投料明细，并保留已填写的实投重量。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-production-orders/new',
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
    console.log('Total updated:', 0)
    return
  }

  let updatedCount = 0
  for (const item of items) {
    if (item.status === 'DONE') {
      console.log('ALREADY DONE:', item.id, item.title)
      continue
    }
    await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    updatedCount += 1
    console.log('DONE:', item.id, item.title)
  }

  console.log('Total updated:', updatedCount)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
