import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import {
  ProcessKitChangeRequestError,
  reviewProcessKitChangeRequest,
} from '@/lib/cosmocoat/process-kit-change-requests'

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reviewNote: z.string().trim().max(500).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = reviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const changeRequest = await reviewProcessKitChangeRequest({
      requestId: id,
      reviewerId: session!.user.id,
      action: parsed.data.action,
      reviewNote: parsed.data.reviewNote,
    })
    return NextResponse.json({ changeRequest })
  } catch (err) {
    if (err instanceof ProcessKitChangeRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书审批表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
