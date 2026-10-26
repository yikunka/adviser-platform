import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const PAGE_SIZE = 20

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.union([z.string().trim().email().max(320), z.literal('')]).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  mailingAddress: z.string().trim().max(500).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  market: z.string().trim().max(120).optional().nullable(),
  expectedVolume: z.string().trim().max(200).optional().nullable(),
  territoryNote: z.string().trim().max(500).optional().nullable(),
  moqNote: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

type SfsCustomerRow = {
  id: string
  source: 'ACCOUNT' | 'MANUAL' | 'ORDER_ONLY'
  userId: string | null
  customerId: string | null
  name: string
  email: string | null
  phone: string | null
  mailingAddress: string | null
  company: string | null
  market: string | null
  expectedVolume: string | null
  territoryNote: string | null
  moqNote: string | null
  notes: string | null
  isActive: boolean | null
  emailVerified: string | null
  accountApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  createdAt: string
  orderCount: number
  latestOrderAt: string | null
  latestOrder: {
    id: string
    sampleCode: string | null
    memorialName: string
    status: string
    clientName: string
    email: string
    contactNumber: string
    mailingAddress: string
    createdAt: string
  } | null
}

function norm(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
}

function orderToLatest(order: {
  id: string
  sampleCode: string | null
  memorialName: string
  status: string
  clientName: string
  email: string
  contactNumber: string
  mailingAddress: string
  createdAt: Date
}) {
  return {
    id: order.id,
    sampleCode: order.sampleCode,
    memorialName: order.memorialName,
    status: order.status,
    clientName: order.clientName,
    email: order.email,
    contactNumber: order.contactNumber,
    mailingAddress: order.mailingAddress,
    createdAt: order.createdAt.toISOString(),
  }
}

function rowMatches(row: SfsCustomerRow, q: string) {
  if (!q) return true
  const latest = row.latestOrder
  const values = [
    row.name,
    row.email,
    row.phone,
    row.mailingAddress,
    row.company,
    row.market,
    row.expectedVolume,
    row.territoryNote,
    row.moqNote,
    row.notes,
    latest?.sampleCode,
    latest?.memorialName,
    latest?.clientName,
    latest?.email,
    latest?.contactNumber,
  ]
  return values.some(v => norm(v).includes(q))
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenus: ['sfsCustomers', 'sfsFactory'] })
  if (error) return error

  const { searchParams } = req.nextUrl
  const q = norm(searchParams.get('q'))
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const approval = searchParams.get('approval')
  const approvalFilter = approval === 'PENDING' || approval === 'APPROVED' || approval === 'REJECTED'
    ? approval
    : null
  const sourceParam = searchParams.get('source')
  const sourceFilter = sourceParam === 'ACCOUNT' || sourceParam === 'MANUAL' || sourceParam === 'ORDER_ONLY'
    ? sourceParam
    : null

  const [customers, users, orders] = await Promise.all([
    prisma.sfsCustomer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, nameEn: true, phone: true, mailingAddress: true, isActive: true, emailVerified: true, accountApprovalStatus: true, createdAt: true } } },
    }),
    prisma.user.findMany({
      where: { platform: 'SFS_DIAMOND' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nameEn: true,
        phone: true,
        mailingAddress: true,
        isActive: true,
        emailVerified: true,
        accountApprovalStatus: true,
        createdAt: true,
      },
    }),
    prisma.sfsOrder.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        customerId: true,
        sampleCode: true,
        memorialName: true,
        status: true,
        clientName: true,
        email: true,
        contactNumber: true,
        mailingAddress: true,
        createdAt: true,
      },
    }),
  ])

  const customersByUserId = new Map(customers.filter(c => c.userId).map(c => [c.userId!, c]))
  const unboundCustomers = customers.filter(c => !c.userId)
  const usedOrderIds = new Set<string>()

  function collectOrders(predicate: (order: (typeof orders)[number]) => boolean) {
    const matched = orders.filter(predicate)
    for (const order of matched) usedOrderIds.add(order.id)
    return matched
  }

  const rows: SfsCustomerRow[] = []

  for (const user of users) {
    const profile = customersByUserId.get(user.id)
    const userOrders = collectOrders(order => (
      order.userId === user.id
      || order.customerId === profile?.id
      || (!order.userId && !order.customerId && norm(order.email) === norm(user.email))
    ))
    const latest = userOrders[0]
    rows.push({
      id: `user:${user.id}`,
      source: 'ACCOUNT',
      userId: user.id,
      customerId: profile?.id ?? null,
      name: profile?.name ?? latest?.clientName ?? user.nameEn,
      email: profile?.email ?? latest?.email ?? user.email,
      phone: profile?.phone ?? latest?.contactNumber ?? user.phone,
      mailingAddress: profile?.mailingAddress ?? latest?.mailingAddress ?? user.mailingAddress,
      company: profile?.company ?? null,
      market: profile?.market ?? null,
      expectedVolume: profile?.expectedVolume ?? null,
      territoryNote: profile?.territoryNote ?? null,
      moqNote: profile?.moqNote ?? null,
      notes: profile?.notes ?? null,
      isActive: user.isActive,
      emailVerified: user.emailVerified?.toISOString() ?? null,
      accountApprovalStatus: user.accountApprovalStatus,
      createdAt: (profile?.createdAt ?? user.createdAt).toISOString(),
      orderCount: userOrders.length,
      latestOrderAt: latest?.createdAt.toISOString() ?? null,
      latestOrder: latest ? orderToLatest(latest) : null,
    })
  }

  for (const customer of unboundCustomers) {
    const customerOrders = collectOrders(order => order.customerId === customer.id)
    const latest = customerOrders[0]
    rows.push({
      id: `customer:${customer.id}`,
      source: 'MANUAL',
      userId: null,
      customerId: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      mailingAddress: customer.mailingAddress,
      company: customer.company,
      market: customer.market,
      expectedVolume: customer.expectedVolume,
      territoryNote: customer.territoryNote,
      moqNote: customer.moqNote,
      notes: customer.notes,
      isActive: null,
      emailVerified: null,
      accountApprovalStatus: null,
      createdAt: customer.createdAt.toISOString(),
      orderCount: customerOrders.length,
      latestOrderAt: latest?.createdAt.toISOString() ?? null,
      latestOrder: latest ? orderToLatest(latest) : null,
    })
  }

  const remainingGroups = new Map<string, typeof orders>()
  for (const order of orders) {
    if (usedOrderIds.has(order.id)) continue
    const key = order.userId ? `missing-user:${order.userId}` : `order-email:${norm(order.email) || order.id}`
    const group = remainingGroups.get(key) ?? []
    group.push(order)
    remainingGroups.set(key, group)
  }

  for (const [key, group] of remainingGroups) {
    const latest = group[0]!
    rows.push({
      id: key,
      source: 'ORDER_ONLY',
      userId: latest.userId,
      customerId: latest.customerId,
      name: latest.clientName,
      email: latest.email,
      phone: latest.contactNumber,
      mailingAddress: latest.mailingAddress,
      company: null,
      market: null,
      expectedVolume: null,
      territoryNote: null,
      moqNote: null,
      notes: null,
      isActive: null,
      emailVerified: null,
      accountApprovalStatus: null,
      createdAt: latest.createdAt.toISOString(),
      orderCount: group.length,
      latestOrderAt: latest.createdAt.toISOString(),
      latestOrder: orderToLatest(latest),
    })
  }

  const filtered = rows
    .filter(row => rowMatches(row, q))
    .filter(row => !approvalFilter || row.accountApprovalStatus === approvalFilter)
    .filter(row => !sourceFilter || row.source === sourceFilter)
    .sort((a, b) => {
      if (approvalFilter === 'PENDING') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      const aTime = new Date(a.latestOrderAt ?? a.createdAt).getTime()
      const bTime = new Date(b.latestOrderAt ?? b.createdAt).getTime()
      return bTime - aTime
    })

  const total = filtered.length
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return NextResponse.json({ customers: paged, total, page, pageSize: PAGE_SIZE })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const customer = await prisma.sfsCustomer.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      mailingAddress: parsed.data.mailingAddress || null,
      company: parsed.data.company || null,
      market: parsed.data.market || null,
      expectedVolume: parsed.data.expectedVolume || null,
      territoryNote: parsed.data.territoryNote || null,
      moqNote: parsed.data.moqNote || null,
      notes: parsed.data.notes || null,
      createdById: session!.user.id,
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'SfsCustomer', customer.id, null, customer)
  return NextResponse.json({ customer }, { status: 201 })
}
