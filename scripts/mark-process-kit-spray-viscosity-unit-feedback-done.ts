/**
 * Mark "工艺书喷涂黏度字段显示单位S" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-spray-viscosity-unit-feedback-done.ts
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
        { title: { contains: '工艺书喷涂黏度字段显示单位S' } },
        { title: { contains: '喷涂黏度字段显示单位' } },
        {
          pageUrl: {
            contains: 'cosmocoat-process-kits/cmqaucmrh000wolw58egfqjvx',
          },
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

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
