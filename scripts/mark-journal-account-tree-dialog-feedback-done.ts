/**
 * Mark journal account tree-dialog feedback as DONE.
 * Run: npx tsx scripts/mark-journal-account-tree-dialog-feedback-done.ts
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
        { title: { contains: '日记账科目选择改为树形弹窗' } },
        {
          AND: [
            { title: { contains: '日记账' } },
            { title: { contains: '科目' } },
            { title: { contains: '树形' } },
          ],
        },
        {
          AND: [
            { pageUrl: { contains: '/admin/financial/cmpuo422m00163iw5o0isz8e1/journal' } },
            { summary: { contains: '树形' } },
            { summary: { contains: '科目' } },
          ],
        },
      ],
    },
  })

  if (items.length === 0) {
    const item = {
      pageUrl: '/zh/admin/financial/cmpuo422m00163iw5o0isz8e1/journal',
      pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
      title: '日记账科目选择改为树形弹窗',
      summary:
        '在新增/编辑日记账页面，将科目选择改为弹窗，按一级、二级、三级科目树形展示层级，并在弹窗内保留按科目编码或名称手动搜索的功能。',
      priority: 'medium',
      conversation: [],
      attachments: [],
      status: 'DONE' as const,
      userEmail: 'admin@6amadvise.com',
      userName: '6AM Admin',
    }
    const created = await prisma.featureRequest.upsert({
      where: { id: 'manual-journal-account-tree-dialog-20260614' },
      create: {
        id: 'manual-journal-account-tree-dialog-20260614',
        ...item,
      },
      update: {
        ...item,
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
