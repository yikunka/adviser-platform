import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const session = await auth()
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { stepId } = await params
  await prisma.sfsOrderStep.delete({ where: { id: stepId } })
  return new NextResponse(null, { status: 204 })
}
