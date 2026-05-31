import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { buildCompanyAccessWhere, resolveCompanyAccess } from '@/lib/company-access'

/** Company picker for invoice forms (invoices menu permission). */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const accessFilter = buildCompanyAccessWhere(access)

  const companies = await prisma.company.findMany({
    where: {
      ...(accessFilter ?? {}),
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { nameEn: { contains: q, mode: 'insensitive' } },
              { companyCode: { contains: q, mode: 'insensitive' } },
              { companyNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, nameEn: true, companyCode: true },
    orderBy: [{ companyCode: 'asc' }, { nameEn: 'asc' }],
    take: 200,
  })

  return NextResponse.json({ companies })
}
