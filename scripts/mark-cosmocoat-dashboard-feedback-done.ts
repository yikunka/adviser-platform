/**
 * Mark the CosmoCoat dashboard statistics feedback item as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-dashboard-feedback-done.ts
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
      status: { not: 'DONE' },
      OR: [
        { title: { contains: 'CosmoCoat统计模块', mode: 'insensitive' } },
        { summary: { contains: '待审批的配方更改数量', mode: 'insensitive' } },
        { summary: { contains: '草稿状态的打样单数量', mode: 'insensitive' } },
        { summary: { contains: '进行中的打样单数量', mode: 'insensitive' } },
        {
          pageUrl: { contains: '/admin/dashboard', mode: 'insensitive' },
          summary: { contains: 'CosmoCoat', mode: 'insensitive' },
        },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  console.log('Found:', items)

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-cosmocoat-dashboard-stats-20260613',
        title: '在Admin Dashboard增加CosmoCoat统计模块',
        summary:
          '在 /admin/dashboard 页面新增 CosmoCoat 统计模块，显示待审批的非 SUPER_ADMIN 配方变更请求数量、DRAFT 状态打样单数量、IN_PROGRESS 状态打样单数量，并让每个指标可点击跳转到对应带筛选条件的列表页。',
        priority: 'medium',
        pageUrl: '/zh/admin/dashboard',
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
