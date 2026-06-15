/**
 * Mark the "辅助核算维度功能模块删除" feedback item as DONE.
 * Run: npx tsx scripts/mark-financial-dimensions-removal-feedback-done.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

for (const name of ['.env', '.env.local']) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

const titlePatterns = [
  '辅助核算维度功能模块删除',
  '辅助核算维度',
  'Dimensions',
]

async function main() {
  const items = await prisma.featureRequest.findMany({
    where: {
      status: { not: 'DONE' },
      pageUrl: { contains: '/admin/financial' },
      OR: [
        ...titlePatterns.map(title => ({ title: { contains: title, mode: 'insensitive' as const } })),
        { summary: { contains: '辅助核算维度功能模块删除', mode: 'insensitive' } },
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
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
