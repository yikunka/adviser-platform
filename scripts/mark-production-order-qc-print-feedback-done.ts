/**
 * Mark "生产单打印时QC测试项目独立显示" feedback as DONE.
 * Run: npx tsx scripts/mark-production-order-qc-print-feedback-done.ts
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
        { title: { contains: '生产单打印时QC测试项目独立显示' } },
        { title: { contains: 'QC测试项目独立显示' } },
        { summary: { contains: 'QC测试项目独立显示' } },
        { summary: { contains: '每一个测试项目都要独立显示为一行' } },
        { pageUrl: { contains: 'cosmocoat-production-orders/cmq5cq6fu00013bw5eudd7rny' } },
      ],
    },
  })

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
  .finally(async () => {
    await prisma.$disconnect()
  })
