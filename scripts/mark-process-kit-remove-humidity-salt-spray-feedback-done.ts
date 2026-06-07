/**
 * Mark "取消性能测试的高温高湿和盐雾选项" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-remove-humidity-salt-spray-feedback-done.ts
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
      OR: [
        { title: { contains: '取消性能测试的高温高湿和盐雾选项' } },
        { summary: { contains: '高温高湿 (65C85%24H)' } },
        { summary: { contains: '盐雾 (5%24H/48H)' } },
        { summary: { contains: '65C85%24H' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-process-kit-remove-humidity-salt-spray-20260607',
        title: '取消性能测试的高温高湿和盐雾选项',
        summary: '从 Process Kit 的性能测试标准选项中移除两个独立测试项目：高温高湿 (65C85%24H) 和盐雾 (5%24H/48H)。创建或编辑工艺书时不再显示这两个独立选项，保留组合项高温高湿/盐雾。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-process-kits/cmq0etshz000r06w5uw853gio',
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

  let updatedCount = 0
  for (const item of items) {
    if (item.status === 'DONE') {
      console.log('ALREADY DONE:', item.id, item.title)
      continue
    }
    await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    updatedCount += 1
    console.log('DONE:', item.id, item.title)
  }

  console.log('Total updated:', updatedCount)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
