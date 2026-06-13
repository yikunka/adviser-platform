/**
 * Mark CosmoCoat customer import and supplier management feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-customer-import-and-suppliers-feedback-done.ts
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
        { title: { contains: 'CosmoCoat客户管理批量导入' } },
        { title: { contains: '客户管理批量导入' } },
        { summary: { contains: '一键表格导入' } },
        { summary: { contains: '仅包含客户名称' } },
        {
          AND: [
            { pageUrl: { contains: 'cosmocoat-customers' } },
            { summary: { contains: '客户名称' } },
            { summary: { contains: 'KH' } },
          ],
        },
        { title: { contains: 'CosmoCoat 供应商管理系统' } },
        { title: { contains: '供应商管理系统' } },
        { summary: { contains: '供应商管理模块' } },
        { summary: { contains: 'cosmocoat-suppliers' } },
        {
          AND: [
            { pageUrl: { contains: 'cosmocoat-customers' } },
            { summary: { contains: '供应商' } },
            { summary: { contains: 'SC' } },
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

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
