/**
 * Mark CosmoCoat employee list display feedback items as DONE:
 * - 员工列表增加五行属性显示
 * - 员工管理列表增加工龄显示
 * Run: npx tsx scripts/mark-cosmocoat-employee-list-display-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const PAGE_URL = '/zh/admin/cosmocoat-employees'
const PAGE_TITLE = '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services'

const FEEDBACK_ITEMS = [
  {
    id: 'manual-cosmocoat-employee-list-five-element-20260612',
    title: '员工列表增加五行属性显示',
    summary:
      '在 CosmoCoat 平台员工管理列表页面中，于「更新日期」列左侧新增一列，显示该员工根据出生日期自动计算生成的五行属性。',
  },
  {
    id: 'manual-cosmocoat-employee-list-service-years-20260612',
    title: '员工管理列表增加工龄显示',
    summary:
      '在 CosmoCoat 员工管理列表中，于入职日期列右侧新增一列显示工龄，并按完整年数计算，满一年才显示 1 年。',
  },
] as const

async function main() {
  let changedCount = 0

  for (const item of FEEDBACK_ITEMS) {
    const match = await prisma.featureRequest.findFirst({
      where: {
        OR: [
          { title: item.title },
          { summary: { contains: item.summary.slice(0, 24) } },
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
        changedCount += 1
        console.log('DONE:', match.id, match.title)
        continue
      }
      console.log('ALREADY DONE:', match.id, match.title)
      continue
    }

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
    changedCount += 1
    console.log('CREATED DONE:', created.id, created.title)
  }

  console.log('Total changed:', changedCount)
}

main().finally(async () => {
  await prisma.$disconnect()
})
