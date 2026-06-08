/**
 * Mark process-kit print feedback items as DONE:
 * - 工艺书打印时性能测试按分组显示
 * - CosmoCoat工艺书打印隐藏产品材料与测试记录
 * Run: npx tsx scripts/mark-process-kit-print-feedback-done.ts
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
        { title: { contains: '工艺书打印时性能测试按分组显示' } },
        { title: { contains: '性能测试按分组显示' } },
        { title: { contains: 'CosmoCoat工艺书打印隐藏产品材料与测试记录' } },
        { title: { contains: '工艺书打印隐藏产品材料' } },
        { summary: { contains: '性能测试项(PERFORMANCE STANDARDS)按照现有详情页的分组方式展示' } },
        { summary: { contains: '不显示「产品材料清单」和「测试记录」' } },
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

main().finally(async () => {
  await prisma.$disconnect()
})
