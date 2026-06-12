/**
 * Mark "新建调色配方 Pantone 预览区域放大4倍" feedback as DONE.
 * Run: npx tsx scripts/mark-color-formula-pantone-preview-enlarge-feedback-done.ts
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
        { title: { contains: '新建调色配方 Pantone 预览区域放大4倍' } },
        { title: { contains: 'Pantone 预览区域放大4倍' } },
        { summary: { contains: 'Pantone 颜色预览区域尺寸放大4倍' } },
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
