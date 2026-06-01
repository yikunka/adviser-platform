import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { z } from 'zod'

const updateSchema = z.object({
  nameEn: z.string().min(1).max(200).optional(),
  nameZh: z.string().max(200).optional(),
  companyNumber: z.string().max(20).optional(),
  companyCode: z.string().max(20).optional().nullable(),
  dateOfIncorporation: z.string().optional(),
  annualReturnDate: z.string().optional().nullable(),
  registeredAddress: z.string().max(500).optional(),
  businessNature: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'DORMANT', 'STRUCK_OFF', 'DEREGISTERED']).optional(),
  serviceTier: z.enum(['BASIC', 'PROFESSIONAL', 'PREMIUM']).optional(),
  financialEnabled: z.boolean().optional(),
  assignedStaffId: z.string().cuid().optional().nullable(),
  staffUserIds: z.array(z.string().cuid()).optional(),
  clientUserId: z.string().cuid().optional().nullable(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      directors: { orderBy: { dateOfAppointment: 'desc' } },
      members: { orderBy: { createdAt: 'desc' }, include: { shareTransactions: { orderBy: { transactionDate: 'desc' } } } },
      significantControllers: true,
      designatedReps: { orderBy: { entryDate: 'asc' } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      fileCases: {
        orderBy: { updatedAt: 'desc' },
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      assignedStaff: { select: { nameEn: true, email: true } },
      staffAssignments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, nameEn: true, email: true, role: true } } },
      },
      clientUser: { select: { nameEn: true, email: true } },
    },
  })

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const before = await prisma.company.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { dateOfIncorporation, annualReturnDate, staffUserIds, ...rest } = parsed.data
  const data = {
    ...rest,
    ...(dateOfIncorporation !== undefined ? { dateOfIncorporation: new Date(dateOfIncorporation) } : {}),
    ...(annualReturnDate !== undefined ? { annualReturnDate: annualReturnDate ? new Date(annualReturnDate) : null } : {}),
    ...(rest.clientUserId !== undefined ? { pendingClientEmail: null as null } : {}),
  }
  const uniqueStaffIds = staffUserIds !== undefined ? Array.from(new Set(staffUserIds)) : undefined
  if (uniqueStaffIds && uniqueStaffIds.length > 0) {
    const staffCount = await prisma.user.count({
      where: {
        id: { in: uniqueStaffIds },
        role: { in: ['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'] },
        isActive: true,
      },
    })
    if (staffCount !== uniqueStaffIds.length) {
      return NextResponse.json({ error: 'Invalid staff assignment' }, { status: 400 })
    }
  }

  const company = await prisma.$transaction(async tx => {
    const updated = await tx.company.update({ where: { id }, data })

    if (uniqueStaffIds !== undefined) {
      await tx.companyStaffAssignment.deleteMany({ where: { companyId: id } })
      if (uniqueStaffIds.length > 0) {
        await tx.companyStaffAssignment.createMany({
          data: uniqueStaffIds.map(userId => ({
            companyId: id,
            userId,
            createdById: session!.user.id,
          })),
          skipDuplicates: true,
        })
      }
    }

    return updated
  })
  await logAudit(session!.user.id, 'UPDATE', 'Company', id, before, company)
  return NextResponse.json(company)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('SUPER_ADMIN')
  if (error) return error

  const { id } = await params
  const before = await prisma.company.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await tx.shareholderChangeDocument.deleteMany({ where: { change: { companyId: id } } })
    await tx.addressChangeDocument.deleteMany({ where: { change: { companyId: id } } })
    await tx.annualFilingDocument.deleteMany({ where: { filing: { companyId: id } } })

    await tx.riskAssessmentAnswer.deleteMany({ where: { companyId: id } })
    await tx.dueDiligenceReport.deleteMany({ where: { companyId: id } })
    await tx.shareholderChange.deleteMany({ where: { companyId: id } })
    await tx.addressChange.deleteMany({ where: { companyId: id } })
    await tx.annualFiling.deleteMany({ where: { companyId: id } })
    await tx.document.deleteMany({ where: { companyId: id } })
    await tx.aMLCheck.deleteMany({ where: { companyId: id } })
    await tx.aMLAlert.deleteMany({ where: { companyId: id } })

    await tx.serviceOrder.updateMany({ where: { companyId: id }, data: { companyId: null } })
    await tx.auditLog.updateMany({ where: { companyId: id }, data: { companyId: null } })

    await tx.company.delete({ where: { id } })
  })

  await logAudit(session!.user.id, 'DELETE', 'Company', id, before, null)
  return NextResponse.json({ message: 'Deleted' })
}
