import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, resolveCompanyAccess } from '@/lib/company-access'

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!companyId) return apiError('Company is required.')

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, companyId))) return apiError('Forbidden', 403)

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const id = req.nextUrl.searchParams.get('id')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100)

  const accounts = await prisma.finAccount.findMany({
    where: {
      companyId,
      ...(id ? { id } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, code: true, name: true, type: true },
    orderBy: [{ code: 'asc' }],
    take: limit,
  })

  return NextResponse.json({ items: accounts })
}
