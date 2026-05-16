import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
  if (error) return error

  const { searchParams } = req.nextUrl
  const resolution = searchParams.get('resolution') ?? undefined
  const result = searchParams.get('result') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50

  const where = {
    ...(resolution && { resolution: resolution as never }),
    ...(result && { result: result as never }),
  }

  const [alerts, total] = await Promise.all([
    prisma.aMLAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        amlRecord: { select: { primaryName: true, source: { select: { nameEn: true } } } },
      },
    }),
    prisma.aMLAlert.count({ where }),
  ])

  return NextResponse.json({ alerts, total, page, pages: Math.ceil(total / limit) })
}
