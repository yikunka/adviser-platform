import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteSfsDesignFile: vi.fn(),
  prismaFindMany: vi.fn(),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    sfsPendingDesignUpload: {
      findMany: mocks.prismaFindMany,
      delete: mocks.delete,
    },
  },
}))
vi.mock('@/lib/storage/r2', () => ({ deleteSfsDesignFile: mocks.deleteSfsDesignFile }))

import { claimPendingDesignUploads, cleanupExpiredSfsDesignUploads, hashSfsDesignDraftToken } from './pending-design-uploads'

describe('SFS pending design uploads', () => {
  it('claims only the current draft uploads and maps their server-side metadata', async () => {
    const upload = {
      id: 'cm123456789012345678901234', storageKey: 'sfs/orders/designs/a.pdf', fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 42,
    }
    mocks.findMany.mockResolvedValueOnce([upload])
    mocks.updateMany.mockResolvedValueOnce({ count: 1 })
    const tx = { sfsPendingDesignUpload: { findMany: mocks.findMany, updateMany: mocks.updateMany } } as never

    await expect(claimPendingDesignUploads(tx, [{ diamondIndex: 2, uploadId: upload.id }], {
      draftTokenHash: 'draft-hash', userId: null,
    })).resolves.toEqual([{ diamondIndex: 2, storageKey: upload.storageKey, fileName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 42 }])
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ draftTokenHash: 'draft-hash' }] }),
    }))
  })

  it('rejects a duplicate upload reference before it can be claimed twice', async () => {
    const tx = { sfsPendingDesignUpload: { findMany: mocks.findMany, updateMany: mocks.updateMany } } as never
    await expect(claimPendingDesignUploads(tx, [
      { diamondIndex: 0, uploadId: 'cm123456789012345678901234' },
      { diamondIndex: 1, uploadId: 'cm123456789012345678901234' },
    ], { draftTokenHash: 'draft-hash', userId: null })).rejects.toThrow('only be used once')
  })

  it('keeps an expired record when OSS deletion fails so the scheduler retries it', async () => {
    mocks.prismaFindMany.mockResolvedValueOnce([{ id: 'cm123456789012345678901234', storageKey: 'sfs/orders/designs/a.pdf' }])
    mocks.deleteSfsDesignFile.mockRejectedValueOnce(new Error('OSS down'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(cleanupExpiredSfsDesignUploads(new Date('2026-09-06T00:00:00.000Z'))).resolves.toEqual({ deleted: 0, failed: 1 })
    error.mockRestore()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('hashes the browser draft token and never stores the raw value', () => {
    expect(hashSfsDesignDraftToken('draft-secret')).not.toBe('draft-secret')
    expect(hashSfsDesignDraftToken('draft-secret')).toBe(hashSfsDesignDraftToken('draft-secret'))
  })
})
