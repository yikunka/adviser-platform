/**
 * Mark "調色配方與打樣單雙向關聯功能" feedback as DONE.
 * Run: npx tsx scripts/mark-color-formula-sample-order-link-feedback-done.ts
 */
import { prisma } from '@/lib/db/prisma'

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      OR: [
        {
          title: '調色配方與打樣單雙向關聯功能',
        },
        {
          AND: [
            { pageUrl: '/zh/admin/cosmocoat-color-formulas/new' },
            { userEmail: 'admin@6amadvise.com' },
            { summary: { contains: '打樣單' } },
            { summary: { contains: '調色配方' } },
          ],
        },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        pageUrl: '/zh/admin/cosmocoat-color-formulas/new',
        pageTitle: '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services',
        title: '調色配方與打樣單雙向關聯功能',
        summary: '在新建調色配方頁面新增字段，允許將調色配方同時關聯到一個或多個打樣單（Sample Order），並在打樣單詳情頁面顯示關聯配方信息，實現雙向可視化追溯。',
        priority: 'medium',
        conversation: [],
        status: 'DONE',
        userEmail: 'admin@6amadvise.com',
        userName: '6AM Admin',
      },
    })
    console.log('CREATED_DONE:', created.id, created.title)
    return
  }

  for (const item of items) {
    if (item.status !== 'DONE') {
      await prisma.featureRequest.update({
        where: { id: item.id },
        data: { status: 'DONE' },
      })
      console.log('DONE:', item.id, item.title)
    } else {
      console.log('ALREADY_DONE:', item.id, item.title)
    }
  }

  console.log('Total updated:', items.length)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
