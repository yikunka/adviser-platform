import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/rbac'
import { resolveCompanyAccess } from '@/lib/company-access'
import { assertCompaniesAccessible } from '@/lib/financial/report-groups'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'

const reportGroupSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  companyIds: z.array(z.string().cuid()).min(1).max(50).optional(),
})

function apiError(error: string, status = 400) {
  return NextResponse.json({ error, toast: error }, { status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = reportGroupSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid report group input')

  const before = await prisma.financialReportGroup.findUnique({
    where: { id },
    include: { companies: true },
  })
  if (!before) return apiError('Report group not found', 404)

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const existingCompanyIds = before.companies.map(company => company.companyId)
  if (!assertCompaniesAccessible(access, existingCompanyIds)) return apiError('Forbidden', 403)

  const companyIds = parsed.data.companyIds
    ? Array.from(new Set(parsed.data.companyIds))
    : undefined
  if (companyIds && !assertCompaniesAccessible(access, companyIds)) return apiError('Forbidden', 403)

  if (companyIds) {
    const companyCount = await prisma.company.count({
      where: {
        id: { in: companyIds },
        financialEnabled: true,
      },
    })
    if (companyCount !== companyIds.length) {
      return apiError('One or more companies are not available for financial reporting')
    }
  }

  const group = await prisma.$transaction(async tx => {
    await tx.financialReportGroup.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
      },
    })

    if (companyIds) {
      await tx.financialReportGroupCompany.deleteMany({ where: { groupId: id } })
      await tx.financialReportGroupCompany.createMany({
        data: companyIds.map((companyId, index) => ({
          groupId: id,
          companyId,
          sortOrder: index,
        })),
        skipDuplicates: true,
      })
    }

    return tx.financialReportGroup.findUniqueOrThrow({
      where: { id },
      include: {
        companies: {
          orderBy: { sortOrder: 'asc' },
          include: {
            company: { select: { id: true, nameEn: true, companyCode: true } },
          },
        },
      },
    })
  })

  await logAudit(session!.user.id, 'UPDATE', 'FinancialReportGroup', id, before, group)
  return NextResponse.json(group)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'financial' })
  if (error) return error

  const { id } = await params
  const before = await prisma.financialReportGroup.findUnique({
    where: { id },
    include: { companies: true },
  })
  if (!before) return apiError('Report group not found', 404)

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!assertCompaniesAccessible(access, before.companies.map(company => company.companyId))) {
    return apiError('Forbidden', 403)
  }

  await prisma.financialReportGroup.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'FinancialReportGroup', id, before, null)
  return NextResponse.json({ ok: true })
}
