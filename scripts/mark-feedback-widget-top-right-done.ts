/**
 * Mark "提交需求" floating button top-right feedback as DONE.
 * Run: npx tsx scripts/mark-feedback-widget-top-right-done.ts
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
        { title: { contains: '浮动按钮移至右上角' } },
        {
          AND: [
            { title: { contains: '提交需求' } },
            { title: { contains: '右上角' } },
          ],
        },
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
