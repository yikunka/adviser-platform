/**
 * Mark "新工艺书产品选择手动输入搜索" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-product-search-feedback-done.ts
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
        { title: { contains: '新工艺书产品选择手动输入搜索' } },
        { title: { contains: '产品选择手动输入搜索' } },
        { title: { contains: '参考产品搜索' } },
        { summary: { contains: '输入产品名称/代码关键词' } },
        { summary: { contains: '输入产品名称或代码关键词' } },
        { summary: { contains: '产品名称/代码关键词进行模糊匹配' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-process-kit-product-search-20260613',
        title: '新工艺书产品选择手动输入搜索',
        summary: '在新建工艺书的添加工艺流程模块中，为参考产品选择组件增加手动输入搜索能力，支持按产品名称或产品代码关键词模糊匹配，便于在大量工厂产品中快速定位目标产品。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-process-kits/new',
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
