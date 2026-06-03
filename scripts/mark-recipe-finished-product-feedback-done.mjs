import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const matches = await prisma.featureRequest.findMany({
  where: {
    OR: [
      { title: { contains: '成品', mode: 'insensitive' } },
      { summary: { contains: '成品', mode: 'insensitive' } },
      { pageUrl: { contains: 'cosmocoat-recipes/new', mode: 'insensitive' } },
    ],
    status: { not: 'DONE' },
  },
  orderBy: { createdAt: 'desc' },
  take: 5,
})

const target = matches.find(
  item =>
    item.title.includes('成品')
    || item.summary.includes('成品')
    || item.summary.includes('工厂产品'),
)

if (!target) {
  console.log('No matching feedback request found')
  process.exit(0)
}

await prisma.featureRequest.update({
  where: { id: target.id },
  data: { status: 'DONE' },
})

console.log(`Marked feedback ${target.id} as DONE: ${target.title || target.summary.slice(0, 80)}`)

await prisma.$disconnect()
