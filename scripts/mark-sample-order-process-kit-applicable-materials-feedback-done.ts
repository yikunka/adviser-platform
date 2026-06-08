/**
 * Mark "打样单工艺书明细显示适用材料" feedback as DONE.
 * Run: npx tsx scripts/mark-sample-order-process-kit-applicable-materials-feedback-done.ts
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
        { title: { contains: '打样单工艺书明细显示适用材料' } },
        { title: { contains: '打样单工藝書明細顯示適用材料' } },
        { summary: { contains: '适用的工厂产品/材料信息' } },
        { summary: { contains: '適用的工廠產品/材料信息' } },
        { summary: { contains: '无需点开即可了解工艺书的用料范围' } },
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
