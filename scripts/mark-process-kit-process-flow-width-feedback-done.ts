/**
 * Mark DONE for the feedback item about adjusting process-flow table widths
 * in the process-kit detail page print preview and Word export.
 *
 * Run: npx tsx scripts/mark-process-kit-process-flow-width-feedback-done.ts
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
        { title: { contains: '工艺书详情页 - 工艺流程表格列宽调整' } },
        { title: { contains: '工艺流程表格列宽调整' } },
        { summary: { contains: '重新调整工艺流程（Process Flow）部分表格的列宽比例' } },
        { summary: { contains: '优化浏览器打印预览和 Word 文档导出的布局效果' } },
      ],
    },
    select: { id: true, title: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'manual-process-kit-process-flow-width-20260613',
        pageUrl: '/zh/admin/cosmocoat-process-kits/cmqby27oe008ncsw57bjkiwge',
        pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
        title: '工艺书详情页 - 工艺流程表格列宽调整',
        summary: '在 Process Kits 工艺书详情页的打印和 Word 导出功能中，重新调整工艺流程（Process Flow）部分表格的列宽比例，优化浏览器打印预览和 Word 文档导出的布局效果，使信息展示更清晰合理。',
        priority: 'medium',
        status: 'DONE',
        userName: '6AM Admin',
        userEmail: 'admin@6amadvise.com',
        conversation: [
          {
            role: 'user',
            text: '在 Process Kits 工艺书详情页的打印和 Word 导出功能中，重新调整工艺流程（Process Flow）部分表格的列宽比例，优化浏览器打印预览和 Word 文档导出的布局效果，使信息展示更清晰合理',
          },
        ],
        attachments: [],
      },
      select: { id: true, title: true },
    })
    console.log('CREATED DONE:', created.id, created.title)
    console.log('Total updated:', 0)
    console.log('Total created:', 1)
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

main().finally(async () => {
  await prisma.$disconnect()
})
