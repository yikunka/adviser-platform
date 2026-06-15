/**
 * Mark financial party auto-code feedback as DONE.
 * Run: npx tsx scripts/mark-financial-party-auto-code-feedback-done.ts
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
      userEmail: { equals: 'admin@6amadvise.com' },
      pageUrl: { contains: '/admin/financial/' },
      OR: [
        { pageUrl: { contains: '/parties' } },
        { title: { contains: '往来单位自动编号' } },
        {
          AND: [
            { summary: { contains: '自动分配唯一编号' } },
            { summary: { contains: '客户 CL-XXXX' } },
          ],
        },
      ],
    },
  })

  if (items.length === 0) {
    const item = {
      pageUrl: '/zh/admin/financial/cmpuo422m00163iw5o0isz8e1/parties',
      pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
      title: '往来单位自动编号功能',
      summary: '在新建往来单位时自动分配唯一编号，根据不同角色类型使用不同前缀：客户 CL-XXXX、供应商 SP-XXXX、员工 ST-XXXX。各类型编号独立计数，从 0001 开始递增，无需手动输入，减少人工录入错误。',
      priority: 'medium',
      conversation: [],
      attachments: [],
      status: 'DONE' as const,
      userEmail: 'admin@6amadvise.com',
      userName: '6AM Admin',
    }
    const created = await prisma.featureRequest.upsert({
      where: { id: 'manual-financial-party-auto-code-20260615' },
      create: {
        id: 'manual-financial-party-auto-code-20260615',
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
