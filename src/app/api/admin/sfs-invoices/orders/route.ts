import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10)))

  const where = q
    ? {
        OR: [
          { sampleCode: { contains: q, mode: 'insensitive' as const } },
          { memorialName: { contains: q, mode: 'insensitive' as const } },
          { clientName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const orders = await prisma.sfsOrder.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      clientName: true,
      memorialName: true,
      sampleCode: true,
      email: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ orders })
}
