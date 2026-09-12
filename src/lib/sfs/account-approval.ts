import { NextResponse } from 'next/server'
import type { AccountApprovalStatus, Platform } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type SfsAccountAccess = {
  userId: string
  status: AccountApprovalStatus
  approved: boolean
}

/**
 * Returns approval state for an SFS client account.
 * Non-SFS platforms are treated as approved (this gate only applies to SFS_DIAMOND clients).
 */
export async function getSfsAccountAccess(
  userId: string,
  platform?: Platform | null,
): Promise<SfsAccountAccess> {
  if (platform && platform !== 'SFS_DIAMOND') {
    return { userId, status: 'APPROVED', approved: true }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountApprovalStatus: true, platform: true },
  })

  if (!user || user.platform !== 'SFS_DIAMOND') {
    return { userId, status: 'APPROVED', approved: true }
  }

  return {
    userId,
    status: user.accountApprovalStatus,
    approved: user.accountApprovalStatus === 'APPROVED',
  }
}

export function sfsApprovalForbiddenResponse(status: AccountApprovalStatus) {
  const message =
    status === 'REJECTED'
      ? 'Your SFS account was not approved. Please contact us for assistance.'
      : 'Your SFS account is pending staff approval. Order details are unavailable until approved.'
  return NextResponse.json(
    { error: message, code: 'SFS_ACCOUNT_PENDING_APPROVAL', status },
    { status: 403 },
  )
}
