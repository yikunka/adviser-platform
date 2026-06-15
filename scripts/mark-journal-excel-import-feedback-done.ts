/**
 * Mark journal Excel import optimization feedback as DONE.
 * Run: npx tsx scripts/mark-journal-excel-import-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const pageUrl = '/zh/admin/financial/cmpks8ssc0u1vqfw5titekho6/journal'
const title = 'Excel导入优化 - 自动编号与科目生成'
const summary = '调整 Financial Accounting 模块 Journal Entries 的 Excel 导入字段顺序为 Date、Voucher Number、Account Code、Account Name、Particular、Debit、Credit；当 Voucher Number 为空时自动生成凭证号；当 Account Code 为空时，根据 Account Name 匹配现有会计科目或自动创建新科目完成导入。'

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      status: { not: 'DONE' },
      userEmail: { equals: 'admin@6amadvise.com' },
      OR: [
        { pageUrl: { contains: '/admin/financial/cmpks8ssc0u1vqfw5titekho6/journal' } },
        { title: { contains: 'Excel导入优化' } },
        {
          AND: [
            { summary: { contains: 'Voucher Number 为空时自动生成凭证号' } },
            { summary: { contains: 'Account Code 为空时' } },
          ],
        },
      ],
    },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.upsert({
      where: { id: 'manual-journal-excel-import-20260615' },
      create: {
        id: 'manual-journal-excel-import-20260615',
        pageUrl,
        pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
        title,
        summary,
        priority: 'medium',
        conversation: [],
        attachments: [],
        status: 'DONE',
        userEmail: 'admin@6amadvise.com',
        userName: '6AM Admin',
      },
      update: {
        pageUrl,
        pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
        title,
        summary,
        priority: 'medium',
        conversation: [],
        attachments: [],
        status: 'DONE',
        userEmail: 'admin@6amadvise.com',
        userName: '6AM Admin',
      },
      select: { id: true, title: true },
    })
    console.log('UPSERTED DONE:', created.id, created.title)
    console.log('Total updated:', 0)
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
