/**
 * Mark CosmoCoat supplier Excel import feedback as DONE.
 * Run: npx tsx scripts/mark-cosmocoat-suppliers-import-feedback-done.ts
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
        { title: { contains: '供应商管理增加Excel导入功能' } },
        {
          AND: [
            { pageUrl: { contains: 'cosmocoat-suppliers' } },
            { summary: { contains: 'Excel' } },
            { summary: { contains: '供应商' } },
          ],
        },
        {
          AND: [
            { pageUrl: { contains: 'cosmocoat-suppliers' } },
            { summary: { contains: '批量导入' } },
            { summary: { contains: '供应商名称' } },
          ],
        },
      ],
    },
  })

  if (items.length === 0) {
    const item = {
      pageUrl: '/zh/admin/cosmocoat-suppliers',
      pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
      title: '供应商管理增加Excel导入功能',
      summary: '在 CosmoCoat 供应商管理页面 /admin/cosmocoat-suppliers 增加批量导入表格功能，支持从 Excel 文件导入供应商数据，其中供应商名称为必填字段，供应商代码可自动生成。',
      priority: 'medium',
      conversation: [],
      attachments: [],
      status: 'DONE' as const,
      userEmail: '3228597681@qq.com',
      userName: '王琪鵬',
    }
    const created = await prisma.featureRequest.upsert({
      where: { id: 'manual-cosmocoat-suppliers-import-20260615' },
      create: {
        id: 'manual-cosmocoat-suppliers-import-20260615',
        ...item,
      },
      update: {
        ...item,
      },
      select: { id: true, title: true },
    })
    console.log('UPSERTED DONE:', created.id, created.title)
    console.log('Total updated:', 0)
    return
  }

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
