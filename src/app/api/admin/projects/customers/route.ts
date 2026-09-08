import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { buildCompanyAccessWhere, resolveCompanyAccess } from '@/lib/company-access'

/** Company + approved KYC person picker for project forms. */
export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'projects' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const accessFilter = buildCompanyAccessWhere(access)

  const companyWhere: Prisma.CompanyWhereInput = {
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
  }

  const keyPersonWhere: Prisma.KeyPersonWhereInput = {
    kycStatus: 'APPROVED',
    ...(q
      ? {
          OR: [
            { kycCode: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameZh: { contains: q, mode: 'insensitive' } },
            { idNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [companies, keyPersons] = await Promise.all([
    prisma.company.findMany({
      where: companyWhere,
      select: { id: true, nameEn: true, companyCode: true },
      orderBy: [{ companyCode: 'asc' }, { nameEn: 'asc' }],
      take: 200,
    }),
    prisma.keyPerson.findMany({
      where: keyPersonWhere,
      select: { id: true, nameEn: true, kycCode: true },
      orderBy: [{ kycCode: 'asc' }, { nameEn: 'asc' }],
      take: 200,
    }),
  ])

  return NextResponse.json({ companies, keyPersons })
}
