import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))

  const suppliers = await prisma.cosSupplier.findMany({
    where: q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
            { contactInfo: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    select: {
      id: true,
      code: true,
      name: true,
      contactPerson: true,
      contactInfo: true,
      address: true,
      shippingAddress: true,
    },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
    take: limit,
  })

  return NextResponse.json({ suppliers })
}
