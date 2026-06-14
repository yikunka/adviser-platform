/**
 * Mark "工艺书变更审批流程" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-change-approval-feedback-done.ts
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
        { title: { contains: '工艺书变更审批流程', mode: 'insensitive' } },
        { title: { contains: '工艺书删除修改超级管理员审批', mode: 'insensitive' } },
        {
          pageUrl: { contains: 'cosmocoat-process-kits', mode: 'insensitive' },
          summary: { contains: '审批', mode: 'insensitive' },
        },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const existingDone = await prisma.featureRequest.findFirst({
      where: {
        OR: [
          { title: { contains: '工艺书变更审批流程' } },
          { title: { contains: '工艺书删除修改超级管理员审批' } },
          {
            pageUrl: { contains: 'cosmocoat-process-kits' },
            summary: { contains: '审批' },
          },
        ],
      },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
    })
    if (existingDone) {
      console.log('ALREADY DONE:', existingDone.id, existingDone.title, existingDone.status)
      console.log('Total updated:', 0)
      return
    }

    const created = await prisma.featureRequest.create({
      data: {
        id: 'process-kit-change-approval-20260614',
        title: '工艺书变更审批流程',
        summary: '在工艺书管理模块添加与配方管理一致的变更审批机制：仅 SUPER_ADMIN 可直接修改或删除已有工艺书；非 SUPER_ADMIN 的修改/删除会创建待审批变更请求，待超级管理员批准后生效。',
        priority: 'high',
        pageUrl: '/zh/admin/cosmocoat-process-kits',
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

  console.log('Found:', items)

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
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
