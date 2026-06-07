/**
 * Mark "生产单详情关联配方工艺与QC标准" feedback as DONE.
 * Run: npx tsx scripts/mark-production-order-recipe-process-qc-feedback-done.ts
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
        { title: { contains: '生产单详情关联配方工艺与QC标准' } },
        { title: { contains: '生产单详情关联配方工艺' } },
        { summary: { contains: '配方工艺与QC标准' } },
        { pageUrl: { contains: 'cosmocoat-production-orders/cmq0x0l32004olow5ai4iv5yn' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-production-order-recipe-process-qc-20260607',
        title: '生产单详情关联配方工艺与QC标准',
        summary: '在 CosmoCoat 生产单管理模块中，创建新生产单选择配方后，自动加载该配方的生产工艺（生产速度、时间、包装要求等）和 QC 质量控制标准（黏度、百格、水煮等测试项目）。这些配方信息在生产单详情页面展示，并允许用户在生产单中进行调整或补充。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-production-orders/cmq0x0l32004olow5ai4iv5yn',
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
