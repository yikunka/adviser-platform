import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
  if (error) return error

  const sources = await prisma.aMLSource.findMany({
    orderBy: { seqNo: 'asc' },
    include: {
      _count: { select: { records: true } },
    },
  })

  return NextResponse.json(
    sources.map(s => ({
      id: s.id,
      seqNo: s.seqNo,
      nameEn: s.nameEn,
      nameZh: s.nameZh,
      format: s.format,
      isActive: s.isActive,
      lastFetched: s.lastFetched,
      recordCount: s._count.records,
    }))
  )
}
