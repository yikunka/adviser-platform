import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import type { UserRole } from '@prisma/client'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import {
  PROJECT_TYPES,
  expireOverdueProjects,
  projectInclude,
  serializeProject,
} from '@/lib/adviser/projects'

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  projectType: z.enum([
    'COMPANY_INCORPORATION',
    'CORPORATE_SECRETARIAL',
    'ACCOUNTING',
    'OTHER',
  ]).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'RENEWED']).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
})

type RouteContext = { params: Promise<{ id: string }> }

async function loadAccessibleProject(id: string, userId: string, role: UserRole) {
  await expireOverdueProjects([id])
  const project = await prisma.advProject.findUnique({
    where: { id },
    include: projectInclude,
  })
  if (!project) return { project: null as null, forbidden: false }

  const access = await resolveCompanyAccess(userId, role)
  if (!(await assertCompanyAccessible(access, project.companyId))) {
    return { project: null, forbidden: true }
  }
  return { project, forbidden: false }
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'projects' })
  if (error) return error

  const { id } = await context.params
  const { project, forbidden } = await loadAccessibleProject(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!project) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  return NextResponse.json({ project: serializeProject(project) })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id } = await context.params
  const { project: before, forbidden } = await loadAccessibleProject(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!before) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : before.startDate
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : before.endDate
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: '日期格式不正确。' }, { status: 400 })
  }
  if (endDate <= startDate) {
    return NextResponse.json({ error: '结束日期必须晚于开始日期。' }, { status: 400 })
  }

  if (parsed.data.projectType && !PROJECT_TYPES.includes(parsed.data.projectType)) {
    return NextResponse.json({ error: '无效的项目类型。' }, { status: 400 })
  }

  const project = await prisma.advProject.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.projectType !== undefined ? { projectType: parsed.data.projectType } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.startDate !== undefined ? { startDate } : {}),
      ...(parsed.data.endDate !== undefined ? { endDate } : {}),
      ...(parsed.data.autoRenew !== undefined ? { autoRenew: parsed.data.autoRenew } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() || null } : {}),
    },
    include: projectInclude,
  })

  await logAudit(session!.user.id, 'UPDATE', 'AdvProject', project.id, before, project)
  return NextResponse.json({ project: serializeProject(project), toast: '项目已更新。' })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.delete')
  if (error) return error

  const { id } = await context.params
  const { project: before, forbidden } = await loadAccessibleProject(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!before) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  await prisma.advProject.delete({ where: { id } })
  await logAudit(session!.user.id, 'DELETE', 'AdvProject', id, before, null)
  return NextResponse.json({ toast: '项目已删除。' })
}
