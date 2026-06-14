/**
 * Mark "打样单工艺书选择下拉搜索功能" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-sample-order-process-kit-search-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = '打样单工艺书选择下拉搜索功能'
const PAGE_URL = '/zh/admin/cosmocoat-sample-orders/new'
const SUMMARY_PREFIX = '在 CosmoCoat 新建打样单页面的「工艺书明细」部分'

async function main() {
  const match = await prisma.featureRequest.findFirst({
    where: {
      OR: [
        { title: TITLE },
        { pageUrl: PAGE_URL },
        { summary: { contains: SUMMARY_PREFIX } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, status: true, pageUrl: true },
  })

  if (match) {
    if (match.status !== 'DONE') {
      await prisma.featureRequest.update({
        where: { id: match.id },
        data: { status: 'DONE' },
      })
      console.log('DONE:', match.id, match.title, match.pageUrl)
      return
    }
    console.log('ALREADY DONE:', match.id, match.title, match.pageUrl)
    return
  }

  const created = await prisma.featureRequest.create({
    data: {
      id: 'manual-cosmocoat-sample-order-process-kit-search-20260614',
      title: TITLE,
      summary:
        '在 CosmoCoat 新建打样单页面的「工艺书明细」部分，为工艺书选择字段添加下拉搜索功能，支持从所有可用的工艺书中快速查找和选择不同的工艺书，提升选品效率。',
      priority: 'medium',
      pageUrl: PAGE_URL,
      pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
      conversation: [],
      attachments: [],
      status: 'DONE',
      userEmail: 'admin@6amadvise.com',
      userName: '6AM Admin',
    },
    select: { id: true, title: true, pageUrl: true },
  })
  console.log('CREATED DONE:', created.id, created.title, created.pageUrl)
}

main().finally(async () => {
  await prisma.$disconnect()
})
