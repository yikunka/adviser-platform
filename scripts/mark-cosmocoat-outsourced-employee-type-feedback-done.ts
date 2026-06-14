/**
 * Mark "员工类型增加编外人员" feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-outsourced-employee-type-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = '员工类型增加编外人员'
const PAGE_URL = '/zh/admin/cosmocoat-employees/cmqbuidj1002pcsw5jywwiow2'

async function main() {
  const match = await prisma.featureRequest.findFirst({
    where: {
      OR: [
        { title: TITLE },
        { title: { contains: '编外人员' } },
        { summary: { contains: '编外人员' } },
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
      id: 'manual-cosmocoat-outsourced-employee-type-20260614',
      title: TITLE,
      summary:
        '在 CosmoCoat 员工管理中新增“编外人员”员工类型，与现有内务、销售、生产、技术四种类型并列使用，员工类型字段支持该新选项。',
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
}

main().finally(async () => {
  await prisma.$disconnect()
})
