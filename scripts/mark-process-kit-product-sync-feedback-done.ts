/**
 * Mark "工艺书产品联动同步改进" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-product-sync-feedback-done.ts
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
        { title: { contains: '工艺书产品联动同步改进' } },
        { title: { contains: '工艺书产品联动' } },
        { summary: { contains: '工艺书产品联动' } },
        { summary: { contains: '相关工艺书中该产品的显示信息应当立即自动刷新' } },
        { pageUrl: { contains: 'cosmocoat-process-kits/cmqadd0dw0te9z0w5vi06i5xm' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'process-kit-product-sync-20260613',
        title: '工艺书产品联动同步改进',
        summary: '在 Process Kits 页面的工艺流程模块中，当关联的工厂产品记录被修改时，所有相关工艺书中该产品的显示信息应当立即自动刷新，无需手动重新打开页面或点击同步按钮。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-process-kits/cmqadd0dw0te9z0w5vi06i5xm',
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
