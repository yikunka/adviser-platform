import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { deleteSfsDesignFile } from '@/lib/storage/r2'
import { hashSfsDesignDraftToken, SFS_DESIGN_DRAFT_COOKIE } from '@/lib/sfs/pending-design-uploads'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const { uploadId } = await params
  const session = await auth()
  const userId = session?.user?.platform === 'SFS_DIAMOND' ? session.user.id : null
  const draftTokenHash = hashSfsDesignDraftToken(req.cookies.get(SFS_DESIGN_DRAFT_COOKIE)?.value)
  const ownership = [
    ...(draftTokenHash ? [{ draftTokenHash }] : []),
    ...(userId ? [{ userId }] : []),
  ]
  if (ownership.length === 0) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const upload = await prisma.sfsPendingDesignUpload.findFirst({
    where: { id: uploadId, claimedAt: null, OR: ownership },
    select: { id: true, storageKey: true },
  })
  if (!upload) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await deleteSfsDesignFile(upload.storageKey)
    await prisma.sfsPendingDesignUpload.delete({ where: { id: upload.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[sfs-design-upload] delete failed', upload.id, error)
    return NextResponse.json({ error: 'Failed to remove uploaded design' }, { status: 503 })
  }
}
