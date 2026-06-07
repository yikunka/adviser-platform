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
      status: { not: 'DONE' },
      OR: [
        { title: { contains: '取消性能测试的高温高湿和盐雾选项' } },
        { summary: { contains: '高温高湿 (65C85%24H)' } },
        { summary: { contains: '盐雾 (5%24H/48H)' } },
        { summary: { contains: '65C85%24H' } },
        { pageUrl: { contains: 'cosmocoat-process-kits/cmq0etshz000r06w5uw853gio' } },
      ],
    },
    select: { id: true, title: true },
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
