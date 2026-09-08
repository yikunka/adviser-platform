import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type AdvProjectStatus, type AdvProjectType } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  buildCompanyAccessWhere,
  resolveCompanyAccess,
} from '@/lib/company-access'
import {
  expireOverdueProjects,
  projectInclude,
  serializeProject,
} from '@/lib/adviser/projects'
import { nextProjectNumber } from '@/lib/adviser/project-number'

const createSchema = z.object({
  companyId: z.string().cuid(),
  title: z.string().min(1).max(200),
  projectType: z.enum([
    'COMPANY_INCORPORATION',
    'CORPORATE_SECRETARIAL',
    'ACCOUNTING',
    'OTHER',
  ]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  autoRenew: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'projects' })
  if (error) return error

  await expireOverdueProjects()

  const { searchParams } = req.nextUrl
  const search = (searchParams.get('q') ?? '').trim()
  const status = searchParams.get('status')
  const projectType = searchParams.get('projectType')
  const companyId = searchParams.get('companyId')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = 20
  const skip = (page - 1) * limit

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (companyId && !(await assertCompanyAccessible(access, companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const companyFilter = buildCompanyAccessWhere(access)
  const where: Prisma.AdvProjectWhereInput = {
    AND: [
      ...(companyFilter ? [{ company: companyFilter }] : []),
      ...(companyId ? [{ companyId }] : []),
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
      orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
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

  const startDate = new Date(parsed.data.startDate)
  const endDate = new Date(parsed.data.endDate)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: '日期格式不正确。' }, { status: 400 })
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: '结束日期必须晚于开始日期。' }, { status: 400 })
  }

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, parsed.data.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, deletedAt: null },
    select: { id: true },
  })
  if (!company) return NextResponse.json({ error: '公司不存在。' }, { status: 404 })

  const project = await prisma.$transaction(async tx => {
    const projectNumber = await nextProjectNumber(startDate, tx, { lockSequence: true })
    return tx.advProject.create({
      data: {
        projectNumber,
        companyId: parsed.data.companyId,
        title: parsed.data.title.trim(),
        projectType: parsed.data.projectType,
        startDate,
        endDate,
        autoRenew: parsed.data.autoRenew ?? true,
        notes: parsed.data.notes?.trim() || null,
        createdById: session!.user.id,
      },
      include: projectInclude,
    })
  })

  await logAudit(session!.user.id, 'CREATE', 'AdvProject', project.id, null, project)
  return NextResponse.json({ project: serializeProject(project), toast: '项目已创建。' }, { status: 201 })
}
