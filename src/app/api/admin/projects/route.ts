import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type AdvProjectStatus, type AdvProjectType, type InvoiceCustomerType } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import {
  buildAdvProjectListAccessFilter,
  expireOverdueProjects,
  projectInclude,
  serializeProject,
} from '@/lib/adviser/projects'
import { nextProjectNumber } from '@/lib/adviser/project-number'

const createSchema = z.object({
  customerType: z.enum(['COMPANY', 'INDIVIDUAL']).default('COMPANY'),
  companyId: z.string().cuid().optional().nullable(),
  keyPersonId: z.string().cuid().optional().nullable(),
  title: z.string().min(1).max(200),
  projectType: z.enum([
    'COMPANY_INCORPORATION',
    'CORPORATE_SECRETARIAL',
    'ACCOUNTING',
    'OTHER',
  ]),
  hasPeriod: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  autoRenew: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
})

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'projects' })
  if (error) return error

  await expireOverdueProjects()

  const { searchParams } = req.nextUrl
  const search = (searchParams.get('q') ?? '').trim()
  const status = searchParams.get('status')
  const projectType = searchParams.get('projectType')
  const companyId = searchParams.get('companyId')
  const customerType = searchParams.get('customerType')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = 20
  const skip = (page - 1) * limit

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (companyId && !(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const accessFilter = buildAdvProjectListAccessFilter(access)
  const where: Prisma.AdvProjectWhereInput = {
    AND: [
      ...(accessFilter ? [accessFilter] : []),
      ...(companyId ? [{ companyId }] : []),
      ...(customerType === 'COMPANY' || customerType === 'INDIVIDUAL'
        ? [{ customerType: customerType as InvoiceCustomerType }]
        : []),
      ...(status ? [{ status: status as AdvProjectStatus }] : []),
      ...(projectType ? [{ projectType: projectType as AdvProjectType }] : []),
      ...(search
        ? [{
            OR: [
              { projectNumber: { contains: search, mode: 'insensitive' as const } },
              { title: { contains: search, mode: 'insensitive' as const } },
              { notes: { contains: search, mode: 'insensitive' as const } },
              { company: { nameEn: { contains: search, mode: 'insensitive' as const } } },
              { company: { companyCode: { contains: search, mode: 'insensitive' as const } } },
              { keyPerson: { nameEn: { contains: search, mode: 'insensitive' as const } } },
              { keyPerson: { kycCode: { contains: search, mode: 'insensitive' as const } } },
            ],
          }]
        : []),
    ],
  }

  const [projects, total] = await Promise.all([
    prisma.advProject.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ projectNumber: 'desc' }],
      include: projectInclude,
    }),
    prisma.advProject.count({ where }),
  ])

  return NextResponse.json({
    projects: projects.map(serializeProject),
    total,
    page,
    limit,
  })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission('projects.create')
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const customerType = parsed.data.customerType
  const companyId = customerType === 'COMPANY' ? (parsed.data.companyId ?? null) : null
  const keyPersonId = customerType === 'INDIVIDUAL' ? (parsed.data.keyPersonId ?? null) : null

  if (customerType === 'COMPANY' && !companyId) {
    return NextResponse.json({ error: '请选择客户公司。' }, { status: 400 })
  }
  if (customerType === 'INDIVIDUAL' && !keyPersonId) {
    return NextResponse.json({ error: '请选择自然人客户。' }, { status: 400 })
  }

  const hasPeriod = parsed.data.hasPeriod ?? Boolean(parsed.data.startDate && parsed.data.endDate)
  let startDate: Date | null = null
  let endDate: Date | null = null
  if (hasPeriod) {
    startDate = parseOptionalDate(parsed.data.startDate)
    endDate = parseOptionalDate(parsed.data.endDate)
    if (!startDate || !endDate) {
      return NextResponse.json({ error: '有服务周期时，开始与结束日期不能为空。' }, { status: 400 })
    }
    if (endDate <= startDate) {
      return NextResponse.json({ error: '结束日期必须晚于开始日期。' }, { status: 400 })
    }
  }

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (companyId && !(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true },
    })
    if (!company) return NextResponse.json({ error: '公司不存在。' }, { status: 404 })
  }

  if (keyPersonId) {
    const person = await prisma.keyPerson.findFirst({
      where: { id: keyPersonId, kycStatus: 'APPROVED' },
      select: { id: true },
    })
    if (!person) return NextResponse.json({ error: '自然人客户不存在或未通过 KYC。' }, { status: 404 })
  }

  const numberRef = startDate ?? new Date()
  const autoRenew = hasPeriod ? (parsed.data.autoRenew ?? true) : false

  const project = await prisma.$transaction(async tx => {
    const projectNumber = await nextProjectNumber(numberRef, tx, { lockSequence: true })
    return tx.advProject.create({
      data: {
        projectNumber,
        customerType,
        companyId,
        keyPersonId,
        title: parsed.data.title.trim(),
        projectType: parsed.data.projectType,
        startDate,
        endDate,
        autoRenew,
        notes: parsed.data.notes?.trim() || null,
        createdById: session!.user.id,
      },
      include: projectInclude,
    })
  })

  await logAudit(session!.user.id, 'CREATE', 'AdvProject', project.id, null, project)
  return NextResponse.json({ project: serializeProject(project), toast: '项目已创建。' }, { status: 201 })
}
