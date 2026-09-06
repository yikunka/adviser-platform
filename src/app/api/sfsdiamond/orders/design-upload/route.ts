import { NextRequest, NextResponse } from 'next/server'
import { uploadSfsDesignFile } from '@/lib/sfs/design-uploads'
import { auth } from '@/lib/auth/auth'
import { rateLimitAuth } from '@/lib/auth/rate-limit'
import { prisma } from '@/lib/db/prisma'
import { deleteSfsDesignFile } from '@/lib/storage/r2'
import {
  createSfsDesignDraftToken,
  designUploadExpiryDate,
  hashSfsDesignDraftToken,
  SFS_DESIGN_DRAFT_COOKIE,
  sfsDesignDraftCookieOptions,
} from '@/lib/sfs/pending-design-uploads'

export async function POST(req: NextRequest) {
  const limited = rateLimitAuth(req)
  if (limited) return limited

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const session = await auth()
  const userId = session?.user?.platform === 'SFS_DIAMOND' ? session.user.id : null
  const existingToken = req.cookies.get(SFS_DESIGN_DRAFT_COOKIE)?.value
  const draftToken = existingToken ?? createSfsDesignDraftToken()
  const draftTokenHash = hashSfsDesignDraftToken(draftToken)

  try {
    const uploaded = await uploadSfsDesignFile(file)
    try {
      const pending = await prisma.sfsPendingDesignUpload.create({
        data: {
          draftTokenHash: draftTokenHash!,
          userId,
          storageKey: uploaded.storageKey,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          expiresAt: designUploadExpiryDate(),
        },
      })
      const response = NextResponse.json({
        uploadId: pending.id,
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        sizeBytes: pending.sizeBytes,
      }, { status: 201 })
      if (!existingToken) response.cookies.set(SFS_DESIGN_DRAFT_COOKIE, draftToken, sfsDesignDraftCookieOptions())
      return response
    } catch (error) {
      await deleteSfsDesignFile(uploaded.storageKey).catch(() => undefined)
      throw error
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const status = message.includes('OSS') || message.includes('storage') || message.includes('SFS 设计稿') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
