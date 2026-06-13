/**
 * Mark "打样单打印增加特急标识" feedback as DONE.
 * Run: npx tsx scripts/mark-sample-order-urgent-print-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
})

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      OR: [
        { title: { contains: '打样单打印增加特急标识' } },
        { AND: [{ title: { contains: '打样单' } }, { title: { contains: '特急' } }] },
        { AND: [{ summary: { contains: '打样单' } }, { summary: { contains: '特急' } }] },
        { pageUrl: { contains: 'cosmocoat-sample-orders/cmqc0pl1z00hscsw5q5ql4map' } },
      ],
    },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-cosmocoat-sample-order-urgent-print-20260613',
        title: '打样单打印增加特急标识',
        summary:
          '在 CosmoCoat 打样单（Sample Orders）的打印输出基本信息区域新增特急复选框，勾选后打印单中的“特急”文字显示为红色，便于识别紧急订单。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-sample-orders/cmqc0pl1z00hscsw5q5ql4map',
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
    return
  }

  for (const item of items) {
    if (item.status === 'DONE') {
      console.log('ALREADY DONE:', item.id, item.title)
      continue
    }
    await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    console.log('DONE:', item.id, item.title)
  }

  console.log('Total updated:', items.length)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
