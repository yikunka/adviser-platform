import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { deleteSfsDesignFile } from '@/lib/storage/r2'

export const SFS_DESIGN_DRAFT_COOKIE = 'sfs_design_draft'
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export type DesignDraftAccess = {
  draftTokenHash: string | null
  userId: string | null
}

export type ClaimedDesignAttachment = {
  diamondIndex: number
  storageKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export function createSfsDesignDraftToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashSfsDesignDraftToken(token: string | null | undefined): string | null {
  if (!token) return null
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function sfsDesignDraftCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/sfsdiamond/orders',
    maxAge: 7 * 24 * 60 * 60,
  }
}

function ownershipWhere(access: DesignDraftAccess): Prisma.SfsPendingDesignUploadWhereInput[] {
  const ownership: Prisma.SfsPendingDesignUploadWhereInput[] = []
  if (access.draftTokenHash) ownership.push({ draftTokenHash: access.draftTokenHash })
  if (access.userId) ownership.push({ userId: access.userId })
  return ownership
}

export async function claimPendingDesignUploads(
  tx: Prisma.TransactionClient,
  refs: Array<{ diamondIndex: number; uploadId?: string }>,
  access: DesignDraftAccess,
): Promise<ClaimedDesignAttachment[]> {
  const uploadIds = refs.flatMap(ref => ref.uploadId ? [ref.uploadId] : [])
  if (uploadIds.length === 0) return []
  if (new Set(uploadIds).size !== uploadIds.length) throw new Error('A design upload can only be used once')

  const ownership = ownershipWhere(access)
  if (ownership.length === 0) throw new Error('Design upload session is missing')
  const now = new Date()
  const uploads = await tx.sfsPendingDesignUpload.findMany({
    where: { id: { in: uploadIds }, claimedAt: null, expiresAt: { gt: now }, OR: ownership },
  })
  if (uploads.length !== uploadIds.length) throw new Error('One or more design uploads are unavailable')

  const claimed = await tx.sfsPendingDesignUpload.updateMany({
    where: { id: { in: uploadIds }, claimedAt: null, expiresAt: { gt: now }, OR: ownership },
    data: { claimedAt: now },
  })
  if (claimed.count !== uploadIds.length) throw new Error('One or more design uploads were already used')

  const byId = new Map(uploads.map(upload => [upload.id, upload]))
  return refs.flatMap(ref => {
    if (!ref.uploadId) return []
    const upload = byId.get(ref.uploadId)
    return upload ? [{
      diamondIndex: ref.diamondIndex,
      storageKey: upload.storageKey,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
    }] : []
  })
}

/** Delete expired, unclaimed files. Rows are kept when object deletion fails for retry. */
export async function cleanupExpiredSfsDesignUploads(now = new Date()): Promise<{ deleted: number; failed: number }> {
  const expired = await prisma.sfsPendingDesignUpload.findMany({
    where: { claimedAt: null, expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
    take: 100,
    select: { id: true, storageKey: true },
  })
  let deleted = 0
  let failed = 0
  for (const upload of expired) {
    try {
      await deleteSfsDesignFile(upload.storageKey)
      await prisma.sfsPendingDesignUpload.delete({ where: { id: upload.id } })
      deleted += 1
    } catch (error) {
      failed += 1
      console.error('[sfs-design-cleanup] failed to delete', upload.id, error)
    }
  }
  return { deleted, failed }
}

export function designUploadExpiryDate(): Date {
  return new Date(Date.now() + RETENTION_MS)
}
