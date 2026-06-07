/**
 * Mark sample-order and QC feedback items as DONE:
 * - 打样单草稿与进行中状态样品图片尺寸放大
 * - 打样单备注位置调整
 * - 打样单和生产订单QC测试结果按行独立显示
 * Run: npx tsx scripts/mark-sample-order-qc-feedback-done.ts
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
        { title: { contains: '打样单草稿与进行中状态样品图片尺寸放大' } },
        { title: { contains: '打样单备注位置调整' } },
        { title: { contains: '打样单和生产订单QC测试结果按行独立显示' } },
        { title: { contains: 'QC测试结果按行独立显示' } },
        { summary: { contains: '参考样品图片(reference sample thumbnail)尺寸' } },
        { summary: { contains: '备注 (notes) 字段从当前位置移动至参考样品图片' } },
        { summary: { contains: '只有被勾选的测试项才在其行上显示独立的测试结果输入字段' } },
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
