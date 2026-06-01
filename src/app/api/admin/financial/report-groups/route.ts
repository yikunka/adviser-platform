import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import {
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { assertCompaniesAccessible } from '@/lib/financial/report-groups'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const reportGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional().nullable(),
  companyIds: z.array(z.string().cuid()).min(1).max(50),
})

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function GET() {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const accessWhere = buildCompanyAccessWhere(access)

  const groups = await prisma.financialReportGroup.findMany({
    where: access.kind === 'all'
      ? undefined
      : { companies: { some: { companyId: { in: access.companyIds } } } },
    orderBy: [{ name: 'asc' }],
    include: {
      companies: {
        orderBy: { sortOrder: 'asc' },
        where: {
          company: {
            is: {
              financialEnabled: true,
              ...(accessWhere ?? {}),
            },
          },
        },
        include: {
          company: {
            select: {
              id: true,
              nameEn: true,
              companyCode: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ groups })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = reportGroupSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Invalid report group input')
  }

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const companyIds = Array.from(new Set(parsed.data.companyIds))
  if (!assertCompaniesAccessible(access, companyIds)) {
    return apiError('Forbidden', 403)
  }

  const companyCount = await prisma.company.count({
    where: {
      id: { in: companyIds },
      financialEnabled: true,
    },
  })
  if (companyCount !== companyIds.length) {
    return apiError('One or more companies are not available for financial reporting')
  }

  const group = await prisma.financialReportGroup.create({
    data: {
      name: parsed.data.name,
      notes: parsed.data.notes || null,
      createdById: session!.user.id,
      companies: {
        create: companyIds.map((companyId, index) => ({
          companyId,
          sortOrder: index,
        })),
      },
    },
    include: {
      companies: {
        orderBy: { sortOrder: 'asc' },
        include: {
          company: {
            select: { id: true, nameEn: true, companyCode: true },
          },
        },
      },
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'FinancialReportGroup', group.id, null, group)
  return NextResponse.json(group, { status: 201 })
}
