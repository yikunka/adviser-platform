import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const PAGE_SIZE = 10

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const q        = searchParams.get('q')?.trim() ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  // status is an enum — only match it when q exactly equals a valid value
  const STATUS_VALUES = ['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED']
  const statusMatch = STATUS_VALUES.includes(q.toUpperCase())
    ? [{ status: q.toUpperCase() as 'PENDING' | 'QUOTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' }]
    : []

  const where = q ? {
    OR: [
      { sampleCode:   { contains: q, mode: 'insensitive' as const } },
      { memorialName: { contains: q, mode: 'insensitive' as const } },
      { clientName:   { contains: q, mode: 'insensitive' as const } },
      { email:        { contains: q, mode: 'insensitive' as const } },
      ...statusMatch,
    ],
  } : {}

  const [orders, total] = await Promise.all([
    prisma.sfsOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { steps: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.sfsOrder.count({ where }),
  ])

  return NextResponse.json({ orders, total, page, pageSize: PAGE_SIZE })
}
