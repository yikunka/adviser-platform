import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/feedback/adapter'
import { requireDevtoolKey } from '@/lib/feedback/devtool-auth'

// GET /api/devtool/requirements
// Query params:
//   status  — one or more: PENDING | IN_PROGRESS | DONE | REJECTED  (default: PENDING,IN_PROGRESS)
//   page    — 1-based (default 1)
//   limit   — max 100 (default 50)
export async function GET(req: NextRequest) {
  const { error } = await requireDevtoolKey(req)
  if (error) return error

  const { searchParams } = req.nextUrl
  const rawStatuses = searchParams.getAll('status')
  const statuses = rawStatuses.length > 0 ? rawStatuses : ['PENDING', 'IN_PROGRESS']
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
  const skip  = (page - 1) * limit

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED']
  const where = {
    status: { in: statuses.filter(s => validStatuses.includes(s)) as ('PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED')[] },
  }

  const [requirements, total] = await Promise.all([
    prisma.featureRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true, title: true, summary: true, priority: true,
        status: true, pageUrl: true, pageTitle: true,
        userName: true, userEmail: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.featureRequest.count({ where }),
  ])

  return NextResponse.json({ requirements, total, page, limit })
}
