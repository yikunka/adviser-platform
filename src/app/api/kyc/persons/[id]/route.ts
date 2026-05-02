import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const p = await prisma.keyPerson.findFirst({
    where: { id, submittedByUserId: session.user.id },
  })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.keyPerson.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
