import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getSignedDownloadUrl } from '@/lib/storage/r2'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { company: { select: { clientUserId: true, pendingClientEmail: true } } },
  })

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Clients can only access their own company's documents
  const staffRoles = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']
  if (!staffRoles.includes(session.user.role)) {
    if (
      doc.uploadedById !== session.user.id
      && doc.company?.clientUserId !== session.user.id
      && doc.company?.pendingClientEmail !== session.user.email.toLowerCase()
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const url = await getSignedDownloadUrl(doc.storageKey, 900)
  if (req.nextUrl.searchParams.get('redirect') === '1') {
    return NextResponse.redirect(url)
  }
  return NextResponse.json({ url })
}
