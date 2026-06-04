import { NextRequest, NextResponse } from 'next/server'
import type { FeedbackAdapter } from '../types'

export function createAdminRoute(adapter: FeedbackAdapter) {
  return {
    async GET(req: NextRequest) {
      const { error } = await adapter.requireAccess()
      if (error) return error

      const status = req.nextUrl.searchParams.get('status') || undefined
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
      const cursor = req.nextUrl.searchParams.get('cursor') || undefined

      const records = await adapter.db.featureRequest.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true, title: true, summary: true, priority: true,
          pageUrl: true, pageTitle: true, status: true,
          userEmail: true, userName: true, attachments: true,
          createdAt: true, updatedAt: true,
        },
      }) as Record<string, unknown>[]

      const hasMore = records.length > limit
      const items = hasMore ? records.slice(0, limit) : records
      const nextCursor = hasMore ? (items[items.length - 1]?.['id'] as string | undefined) : null

      return NextResponse.json({ items, nextCursor, hasMore })
    },
  }
}
