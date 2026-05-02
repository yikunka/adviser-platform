import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const staffRoles = ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN']
  const isStaff = staffRoles.includes(session.user.role)

  const docs = await prisma.document.findMany({
    where: isStaff ? {} : {
      OR: [
        { uploadedById: session.user.id },
        { company: { clientUserId: session.user.id } },
      ],
      deletedAt: null,
    },
    include: { company: { select: { nameEn: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(docs)
}
