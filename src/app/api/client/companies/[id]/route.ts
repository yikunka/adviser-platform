import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('CLIENT')
  if (error) return error

  const { id } = await params
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      directors: { orderBy: { dateOfAppointment: 'desc' } },
      members: { orderBy: { createdAt: 'desc' } },
      significantControllers: { orderBy: { becomingDate: 'desc' } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  })

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (company.clientUserId !== session!.user.id && company.pendingClientEmail !== session!.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(company)
}
