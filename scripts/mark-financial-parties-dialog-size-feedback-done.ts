/**
 * Mark financial parties dialog-size feedback as DONE.
 * Run: npx tsx scripts/mark-financial-parties-dialog-size-feedback-done.ts
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
        { title: { contains: '增大往来单位弹窗尺寸' } },
        {
          AND: [
            { title: { contains: '往来单位' } },
            { title: { contains: '弹窗' } },
          ],
        },
        {
          AND: [
            { summary: { contains: '往来单位' } },
            { summary: { contains: '弹窗' } },
            { summary: { contains: '偏小' } },
          ],
        },
        {
          AND: [
            { userEmail: { equals: 'admin@6amadvise.com' } },
            { pageUrl: { contains: '/admin/financial/' } },
            { pageUrl: { contains: '/accounts' } },
            { summary: { contains: '往来单位' } },
          ],
        },
        {
          AND: [
            { userEmail: { equals: 'admin@6amadvise.com' } },
            { pageUrl: { contains: '/admin/financial/' } },
            { pageUrl: { contains: '/parties' } },
          ],
        },
      ],
    },
  })

  if (items.length === 0) {
    const item = {
      pageUrl: '/zh/admin/financial/cmpkppbnh0u0lqfw5350jraae/accounts',
      pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
      title: '增大往来单位弹窗尺寸',
      summary:
        '在财务模块的往来单位（Parties）页面，编辑或新建往来单位的弹窗窗口偏小，需要扩大弹窗尺寸以便容纳更多字段信息，提升用户填写体验。',
      priority: 'medium',
      conversation: [],
      attachments: [],
      status: 'DONE' as const,
      userEmail: 'admin@6amadvise.com',
      userName: '6AM Admin',
    }
    const created = await prisma.featureRequest.upsert({
      where: { id: 'manual-financial-parties-dialog-size-20260615' },
      create: {
        id: 'manual-financial-parties-dialog-size-20260615',
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
