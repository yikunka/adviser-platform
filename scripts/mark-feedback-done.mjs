import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const title = process.argv[2] ?? '工艺产品列表添加修改功能'

const items = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: title } },
      { title: { contains: '工艺产品列表' } },
    ],
    status: { not: 'DONE' },
  },
  select: { id: true, title: true, status: true },
})

if (items.length === 0) {
  console.log('No matching feedback items found (may already be DONE)')
} else {
  for (const item of items) {
    const updated = await prisma.featureRequest.update({
      where: { id: item.id },
      data: { status: 'DONE' },
    })
    console.log(`Marked DONE: ${updated.id} — ${updated.title}`)
  }
}

await prisma.$disconnect()
