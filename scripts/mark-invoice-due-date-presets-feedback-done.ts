/**
 * Mark Adviser invoice due-date presets feedback as DONE.
 * Run: npx tsx scripts/mark-invoice-due-date-presets-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const FEEDBACK_ITEM = {
  id: 'manual-invoice-due-date-presets-20260615',
  title: '发票到期日快速选项（月结/30天/60天）',
  summary:
    '在创建发票页面 (/admin/invoices/new) 的到期日字段中添加快速选择选项，包括「月结」、「月结30天」、「月结60天」。选择这些选项后，系统根据当前日期或发票日期自动计算出具体到期日并填入表单。',
  pageUrl: '/zh/admin/invoices/new',
  pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
  userEmail: 'admin@6amadvise.com',
  userName: '6AM Admin',
} as const

async function main() {
  const existing = await prisma.featureRequest.findFirst({
    where: {
      OR: [
        { title: FEEDBACK_ITEM.title },
        {
          AND: [
            { pageUrl: { contains: '/admin/invoices/new' } },
            { summary: { contains: '月结30天' } },
          ],
        },
        {
          AND: [
            { pageUrl: { contains: '/admin/invoices/new' } },
            { summary: { contains: '到期日字段' } },
          ],
        },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (!existing) {
    const created = await prisma.featureRequest.create({
      data: {
        id: FEEDBACK_ITEM.id,
        title: FEEDBACK_ITEM.title,
        summary: FEEDBACK_ITEM.summary,
        priority: 'medium',
        pageUrl: FEEDBACK_ITEM.pageUrl,
        pageTitle: FEEDBACK_ITEM.pageTitle,
        conversation: [],
        attachments: [],
        status: 'DONE',
        userEmail: FEEDBACK_ITEM.userEmail,
        userName: FEEDBACK_ITEM.userName,
      },
      select: { id: true, title: true, status: true },
    })
    console.log('CREATED DONE:', created.id, created.title, created.status)
    return
  }

  if (existing.status === 'DONE') {
    console.log('ALREADY DONE:', existing.id, existing.title)
    return
  }

  const updated = await prisma.featureRequest.update({
    where: { id: existing.id },
    data: { status: 'DONE' },
    select: { id: true, title: true, status: true },
  })
  console.log('DONE:', updated.id, updated.title, updated.status)
}

main().finally(async () => {
  await prisma.$disconnect()
})
