/**
 * Mark Adviser invoice line-item layout feedback as DONE.
 * Run: npx tsx scripts/mark-invoice-line-layout-feedback-done.ts
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
  id: 'manual-invoice-line-layout-20260615',
  title: 'Adviser 发票明细行版面优化 - 扩大描述字段空间',
  summary:
    '在 Adviser 平台发票管理页面（/admin/invoices）创建和编辑发票时，需要增大明细行中“描述”字段的输入空间，并调整整行明细项目的版面布局比例，使输入体验更佳。',
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
            { pageUrl: { contains: '/admin/invoices' } },
            { summary: { contains: '描述字段' } },
          ],
        },
        {
          AND: [
            { title: { contains: '发票' } },
            { title: { contains: '描述字段' } },
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
