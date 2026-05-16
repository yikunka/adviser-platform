import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const { stepId } = await params
  await prisma.sfsOrderStep.delete({ where: { id: stepId } })
  return new NextResponse(null, { status: 204 })
}
