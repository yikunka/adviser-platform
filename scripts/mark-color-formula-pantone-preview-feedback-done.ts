/**
 * Mark color-formula Pantone input and preview feedback as DONE.
 * Run: npx tsx scripts/mark-color-formula-pantone-preview-feedback-done.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const TITLE = '配色配方表单恢复Pantone颜色输入与预览功能'
const SUMMARY = '在新建调色配方（Color Matching Formulas）创建页面中，备注字段上方恢复 Pantone 颜色输入框及右侧对应的 Pantone 颜色预览色块功能。'
const PAGE_URL = '/zh/admin/cosmocoat-color-formulas/new'
const PAGE_TITLE = '6AM Advisory | Hong Kong Company Formation, TCSP & Corporate Services'

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      status: { not: 'DONE' },
      OR: [
        { title: { contains: TITLE } },
        { title: { contains: 'Pantone' } },
        { title: { contains: 'PANTONE' } },
        { title: { contains: '配色配方表单恢复' } },
        { pageUrl: { contains: 'cosmocoat-color-formulas/new' } },
        { summary: { contains: 'Pantone' } },
        { summary: { contains: 'PANTONE' } },
        { summary: { contains: 'Pantone 颜色输入框' } },
      ],
    },
    select: { id: true, title: true, status: true },
  })

  if (items.length === 0) {
    const existingDone = await prisma.featureRequest.findFirst({
      where: {
        status: 'DONE',
        OR: [
          { title: TITLE },
          { title: { contains: 'Pantone' } },
          { summary: { contains: 'Pantone 颜色输入框' } },
        ],
      },
      select: { id: true, title: true },
    })

    if (existingDone) {
      console.log('ALREADY DONE:', existingDone.id, existingDone.title)
      console.log('Total updated:', 0)
      return
    }

    const created = await prisma.featureRequest.create({
      data: {
        title: TITLE,
        summary: SUMMARY,
        priority: 'medium',
        pageUrl: PAGE_URL,
        pageTitle: PAGE_TITLE,
        conversation: [],
        attachments: [],
        status: 'DONE',
        userEmail: 'admin@6amadvise.com',
        userName: '6AM Admin',
      },
      select: { id: true, title: true },
    })
    console.log('CREATED DONE:', created.id, created.title)
    console.log('Total updated:', 1)
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
  .finally(async () => {
    await prisma.$disconnect()
  })
