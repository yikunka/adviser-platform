import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { FeedbackAdapter } from '../types'

const updateSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED']).optional(),
})

export function createAdminIdRoute(adapter: FeedbackAdapter) {
  return {
    async GET(
      _req: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) {
      const { error } = await adapter.requireAccess()
      if (error) return error
      const { id } = await params
      const record = await adapter.db.featureRequest.findUnique({ where: { id } })
      if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ item: record })
    },

    async PATCH(
      req: NextRequest,
      { params }: { params: Promise<{ id: string }> },
    ) {
      const { error } = await adapter.requireAccess()
      if (error) return error
      const { id } = await params
      const body = await req.json().catch(() => null)
      const parsed = updateSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
      const record = await adapter.db.featureRequest.findUnique({ where: { id } })
      if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = await adapter.db.featureRequest.update({
        where: { id },
        data: parsed.data.status ? { status: parsed.data.status } : {},
      })
      return NextResponse.json({ item: updated })
    },
  }
}
