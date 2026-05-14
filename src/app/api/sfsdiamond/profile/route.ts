import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

// ── GET /api/sfsdiamond/profile ───────────────────────────────────────
// Returns the current user's saved phone and mailingAddress for form pre-fill.
export async function GET() {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, mailingAddress: true },
  })

  return NextResponse.json({ phone: user?.phone ?? '', mailingAddress: user?.mailingAddress ?? '' })
}
