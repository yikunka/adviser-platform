import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/aml/sources/[id]/records
 * Paginated sanctions / FATF records for a source (for expandable list content).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
  if (error) return error

  const { id } = await params
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50))

  const source = await prisma.aMLSource.findUnique({
    where: { id },
    select: { id: true, seqNo: true, nameEn: true, nameZh: true },
  })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const where = { sourceId: id }
  const [total, records] = await Promise.all([
    prisma.aMLRecord.count({ where }),
    prisma.aMLRecord.findMany({
      where,
      orderBy: { primaryName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        primaryName: true,
        aliases: true,
        entityType: true,
        nationality: true,
        listingReason: true,
        listingDate: true,
      },
    }),
  ])

  return NextResponse.json({
    source,
    total,
    page,
    pageSize,
    records: records.map(r => ({
      ...r,
      listingDate: r.listingDate?.toISOString() ?? null,
    })),
  })
}
