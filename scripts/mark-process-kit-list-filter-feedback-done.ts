/**
 * Mark "工艺书列表增加下拉筛选功能" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-list-filter-feedback-done.ts
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
        { title: { contains: '工艺书列表增加下拉筛选功能' } },
        { title: { contains: '工艺书列表筛选功能' } },
        { title: { contains: '工艺书管理页面' } },
        { summary: { contains: '按不同条件（如状态、日期范围等）快速过滤和查找工艺书记录' } },
        { summary: { contains: '状态、日期范围' } },
      ],
      userEmail: 'admin@6amadvise.com',
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'process-kit-list-filter-20260614',
        title: '工艺书列表增加下拉筛选功能',
        summary: '在 CosmoCoat 工艺书管理页面的列表区域增加状态、日期字段与日期范围下拉筛选，支持最近 7/30/90 天和自定义起止日期，便于快速过滤和查找工艺书记录。',
        priority: 'medium',
        pageUrl: '/admin/cosmocoat-process-kits',
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
