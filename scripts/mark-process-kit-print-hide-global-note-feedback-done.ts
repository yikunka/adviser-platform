/**
 * Mark "工艺书打印移除全局备注避免重复" feedback as DONE.
 * Run: npx tsx scripts/mark-process-kit-print-hide-global-note-feedback-done.ts
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
      OR: [
        { title: { contains: '工艺书打印移除全局备注避免重复' } },
        { title: { contains: '全局备注避免重复' } },
        { summary: { contains: 'global process-flow note' } },
        { summary: { contains: '全局備註' } },
        { pageUrl: { contains: 'cosmocoat-process-kits/cmqaucmrh000wolw58egfqjvx' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const created = await prisma.featureRequest.create({
      data: {
        id: 'process-kit-print-hide-global-note-20260613',
        title: '工艺书打印移除全局备注避免重复',
        summary:
          '在工藝書頁面 /admin/cosmocoat-process-kits，網頁端仍顯示 global process-flow note（全局備註）字段，但在 A4 打印和 Word 導出時需隱藏該字段以避免重複出現。只輸出核心工藝信息：基本資訊、性能標準和工藝流程步驟。',
        priority: 'medium',
        pageUrl: '/zh/admin/cosmocoat-process-kits/cmqaucmrh000wolw58egfqjvx',
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
    console.log('Total updated:', 0)
    return
  }

  let updatedCount = 0
  for (const item of items) {
    if (item.status === 'DONE') {
      console.log('ALREADY DONE:', item.id, item.title)
      continue
    }
    await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    updatedCount += 1
    console.log('DONE:', item.id, item.title)
  }

  console.log('Total updated:', updatedCount)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
