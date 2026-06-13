/**
 * Mark "CosmoCoat员工详情增加身份证号及自动生成五行生肖" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-employee-id-card-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = 'CosmoCoat员工详情增加身份证号及自动生成五行生肖'
const SUMMARY_PREFIX = '在员工详情页面新增身份证号输入字段'

async function main() {
  const match = await prisma.featureRequest.findFirst({
    where: {
      OR: [
        { title: TITLE },
        { title: { contains: '身份证号及自动生成五行生肖' } },
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
      id: 'manual-cosmocoat-employee-id-card-20260613',
      title: TITLE,
      summary:
        '在员工详情页面新增身份证号输入字段，支持身份证号码格式校验。系统根据身份证号自动提取出生日期，并计算五行和生肖信息。首次创建时从身份证号获取数据；后续员工手动修改出生日期后，以手动填写的日期为准覆盖身份证号中的日期。',
      priority: 'medium',
      pageUrl: '/zh/admin/cosmocoat-employees',
      pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
      conversation: [],
      attachments: [],
      status: 'DONE',
      userEmail: '3228597681@qq.com',
      userName: 'ballon',
    },
    select: { id: true, title: true },
  })
  console.log('CREATED DONE:', created.id, created.title)
}

main().finally(async () => {
  await prisma.$disconnect()
})
