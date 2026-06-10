/**
 * Mark the CosmoCoat recipe shelf-life and production-order print color feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-shelf-life-print-color-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const REQUESTS = [
  {
    title: 'CosmoCoat 配方管理 - 增加保质期字段',
    summary:
      '在配方详情页 (/admin/cosmocoat-recipes/[id]) 中，在产品黏度输入框附近新增保质期输入字段，单位为天，用于记录配方产品的保质期天数信息。',
    pageUrl: '/zh/admin/cosmocoat-recipes/cmppmon73002040w5om28y0hi',
    pageId: 'cmppmon73002040w5om28y0hi',
  },
  {
    title: 'CosmoCoat 生产单打印颜色加深',
    summary:
      'CosmoCoat 平台生产订单在生产单（Print Production Order）页面导出/打印时，将所有区域的颜色加深，提高对比度方便操作人员查看，不改变现有内容和布局。',
    pageUrl: '/zh/admin/cosmocoat-production-orders/cmq7hwsh00t6g16w53l93ftpp',
    pageId: 'cmq7hwsh00t6g16w53l93ftpp',
  },
] as const

async function main() {
  let updatedCount = 0

  for (const request of REQUESTS) {
    const match = await prisma.featureRequest.findFirst({
      where: {
        OR: [
          { title: request.title },
          { pageUrl: { contains: request.pageId } },
        ],
      },
      select: { id: true, title: true, status: true },
    })

    if (match) {
      if (match.status !== 'DONE') {
        await prisma.featureRequest.update({
          where: { id: match.id },
          data: { status: 'DONE' },
        })
        updatedCount += 1
      }
      console.log(match.status === 'DONE' ? 'ALREADY DONE:' : 'DONE:', match.id, match.title)
      continue
    }

    const created = await prisma.featureRequest.create({
      data: {
        title: request.title,
        summary: request.summary,
        priority: 'medium',
        pageUrl: request.pageUrl,
        pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
        conversation: [],
        attachments: [],
        status: 'DONE',
        userEmail: 'admin@6amadvise.com',
        userName: '6AM Admin',
      },
      select: { id: true, title: true },
    })
    updatedCount += 1
    console.log('CREATED DONE:', created.id, created.title)
  }

  console.log('Total changed:', updatedCount)
}

main().finally(async () => {
  await prisma.$disconnect()
})
