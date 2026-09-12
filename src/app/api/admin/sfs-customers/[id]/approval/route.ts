import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const schema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
})

function resolveUserId(idParam: string): string | null {
  if (idParam.startsWith('user:')) return idParam.slice('user:'.length) || null
  if (!idParam.includes(':')) return idParam
  return null
}

/**
 * POST /api/admin/sfs-customers/[id]/approval
 * Approve / reject / reset an online-registered SFS account.
 * `id` may be `user:<userId>` (list row id) or a bare user id.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'sfsCustomers' })
  if (error) return error

  const { id: idParam } = await params
  const userId = resolveUserId(idParam)
  if (!userId) {
    return NextResponse.json({ error: 'Only registered platform accounts can be approved' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      platform: true,
      accountApprovalStatus: true,
      accountApprovedAt: true,
    },
  })
  if (!before || before.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'SFS account not found' }, { status: 404 })
  }

  const nextStatus = parsed.data.status
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      accountApprovalStatus: nextStatus,
      accountApprovedAt: nextStatus === 'APPROVED' ? new Date() : null,
      accountApprovedById: nextStatus === 'APPROVED' ? session!.user.id : null,
    },
    select: {
      id: true,
      email: true,
      accountApprovalStatus: true,
      accountApprovedAt: true,
    },
  })

  await logAudit(
    session!.user.id,
    'SFS_ACCOUNT_APPROVAL_UPDATE',
    'User',
    user.id,
    {
      accountApprovalStatus: before.accountApprovalStatus,
      accountApprovedAt: before.accountApprovedAt,
    },
    {
      accountApprovalStatus: user.accountApprovalStatus,
      accountApprovedAt: user.accountApprovedAt,
    },
  )

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    accountApprovalStatus: user.accountApprovalStatus,
    accountApprovedAt: user.accountApprovedAt,
  })
}
