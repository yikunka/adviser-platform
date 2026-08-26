/**
 * One-off: merge Man Hin Wong duplicate SFS profiles into the registered account
 * with phone 4372158283.
 *
 * Usage (with DB up on DATABASE_URL):
 *   npx tsx scripts/merge-man-hin-wong.mts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local'), override: true })

const { mergeSfsCustomers } = await import('../src/lib/sfs/merge-customers')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function digits(p: string | null | undefined) {
  return (p ?? '').replace(/\D/g, '')
}

async function main() {
  const keepPhone = '4372158283'
  const mergePhone = '4379818123'

  const customers = await prisma.sfsCustomer.findMany({
    where: {
      OR: [
        { name: { contains: 'Man Hin Wong', mode: 'insensitive' } },
        { name: { contains: 'Man Hin', mode: 'insensitive' } },
        { phone: { contains: '437', mode: 'insensitive' } },
      ],
    },
    include: {
      user: { select: { id: true, email: true, phone: true, nameEn: true, isActive: true } },
      _count: { select: { orders: true } },
    },
  })

  const users = await prisma.user.findMany({
    where: {
      platform: 'SFS_DIAMOND',
      OR: [
        { nameEn: { contains: 'Man Hin Wong', mode: 'insensitive' } },
        { phone: { contains: '437', mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, phone: true, nameEn: true, isActive: true },
  })

  console.log('Matched customers:')
  for (const c of customers) {
    console.log({
      id: c.id,
      name: c.name,
      phone: c.phone,
      phoneDigits: digits(c.phone),
      userId: c.userId,
      userPhone: c.user?.phone,
      orders: c._count.orders,
    })
  }
  console.log('Matched users:', users.map(u => ({ ...u, phoneDigits: digits(u.phone) })))

  let target = customers.find(c => digits(c.phone) === keepPhone || digits(c.user?.phone) === keepPhone)
  if (!target) {
    const keepUser = users.find(u => digits(u.phone) === keepPhone)
    if (!keepUser) throw new Error(`Could not find keep account with phone ${keepPhone}`)
    const existing = await prisma.sfsCustomer.findUnique({ where: { userId: keepUser.id } })
    if (existing) {
      target = { ...existing, user: keepUser, _count: { orders: 0 } } as typeof customers[number]
    } else {
      const created = await prisma.sfsCustomer.create({
        data: {
          userId: keepUser.id,
          name: keepUser.nameEn,
          email: keepUser.email,
          phone: keepUser.phone,
        },
      })
      target = { ...created, user: keepUser, _count: { orders: 0 } } as typeof customers[number]
      console.log('Created target customer profile', created.id)
    }
  }

  const sources = customers.filter(c => {
    if (c.id === target!.id) return false
    const d = digits(c.phone) || digits(c.user?.phone)
    if (d === mergePhone) return true
    if (!c.userId && /man\s*hin\s*wong/i.test(c.name)) return true
    return false
  })

  // Also ensure registered merge-phone user has a customer profile included
  const mergeUser = users.find(u => digits(u.phone) === mergePhone)
  if (mergeUser) {
    let mergeCustomer = customers.find(c => c.userId === mergeUser.id)
    if (!mergeCustomer) {
      const existing = await prisma.sfsCustomer.findUnique({ where: { userId: mergeUser.id } })
      if (existing) mergeCustomer = { ...existing, user: mergeUser, _count: { orders: 0 } } as typeof customers[number]
      else {
        const created = await prisma.sfsCustomer.create({
          data: {
            userId: mergeUser.id,
            name: mergeUser.nameEn,
            email: mergeUser.email,
            phone: mergeUser.phone,
          },
        })
        mergeCustomer = { ...created, user: mergeUser, _count: { orders: 0 } } as typeof customers[number]
      }
    }
    if (mergeCustomer && !sources.some(s => s.id === mergeCustomer!.id) && mergeCustomer.id !== target.id) {
      sources.push(mergeCustomer)
    }
  }

  if (sources.length === 0) {
    console.log('Nothing to merge. Target:', target.id)
    return
  }

  console.log('TARGET', { id: target.id, name: target.name, phone: target.phone, userId: target.userId })
  console.log('SOURCES', sources.map(s => ({ id: s.id, name: s.name, phone: s.phone, userId: s.userId, orders: s._count?.orders })))

  const result = await mergeSfsCustomers(prisma, {
    targetCustomerId: target.id,
    sourceCustomerIds: sources.map(s => s.id),
  })
  console.log('MERGE RESULT', result)

  const finalOrders = await prisma.sfsOrder.count({
    where: {
      OR: [
        { customerId: target.id },
        ...(target.userId ? [{ userId: target.userId }] : []),
      ],
    },
  })
  console.log('Target order count after merge:', finalOrders)
}

main()
  .catch(e => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
