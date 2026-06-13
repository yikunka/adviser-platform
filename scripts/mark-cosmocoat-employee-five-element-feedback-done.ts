/**
 * Mark "员工列表增加五行属性显示" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-employee-five-element-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = '员工列表增加五行属性显示'
const SUMMARY_PREFIX = '在 CosmoCoat 平台员工管理列表页面中，于「更新日期」列左侧新增一列'

async function main() {
  const match = await prisma.featureRequest.findFirst({
    where: {
      OR: [
        { title: TITLE },
        { summary: { contains: SUMMARY_PREFIX } },
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
      console.log('DONE:', match.id, match.title)
      return
    }
    console.log('ALREADY DONE:', match.id, match.title)
    return
  }

  const created = await prisma.featureRequest.create({
    data: {
      id: 'manual-cosmocoat-employee-list-five-element-20260612',
      title: TITLE,
      summary:
        '在 CosmoCoat 平台员工管理列表页面中，于「更新日期」列左侧新增一列，显示该员工根据出生日期自动计算生成的五行属性。',
      priority: 'medium',
      pageUrl: '/zh/admin/cosmocoat-employees',
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
}

main().finally(async () => {
  await prisma.$disconnect()
})
