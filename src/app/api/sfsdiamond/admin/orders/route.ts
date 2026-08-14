import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import type { SfsOrderStatus } from '@prisma/client'

const PAGE_SIZE = 10

const STATUS_VALUES = ['PENDING', 'QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const satisfies readonly SfsOrderStatus[]

function parseStatus(raw: string | null): SfsOrderStatus | undefined {
  if (!raw) return undefined
  const value = raw.trim().toUpperCase()
  return (STATUS_VALUES as readonly string[]).includes(value)
    ? (value as SfsOrderStatus)
    : undefined
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const status = parseStatus(searchParams.get('status'))

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { sampleCode: { contains: q, mode: 'insensitive' as const } },
            { memorialName: { contains: q, mode: 'insensitive' as const } },
            { clientName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

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
