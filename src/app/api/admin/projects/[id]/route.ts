import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import type { UserRole } from '@prisma/client'
import {
  PROJECT_TYPES,
  assertAdvProjectAccessible,
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
  hasPeriod: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  autoRenew: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
})

type RouteContext = { params: Promise<{ id: string }> }

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function loadAccessibleProject(id: string, userId: string, role: UserRole) {
  await expireOverdueProjects([id])
  const project = await prisma.advProject.findUnique({
    where: { id },
    include: projectInclude,
  })
  if (!project) return { project: null as null, forbidden: false }

  if (!(await assertAdvProjectAccessible(project, userId, role))) {
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

  if (parsed.data.projectType && !PROJECT_TYPES.includes(parsed.data.projectType)) {
    return NextResponse.json({ error: '无效的项目类型。' }, { status: 400 })
  }

  const hasPeriod = parsed.data.hasPeriod
    ?? (parsed.data.startDate !== undefined || parsed.data.endDate !== undefined
      ? Boolean(
        (parsed.data.startDate !== undefined ? parsed.data.startDate : before.startDate)
        && (parsed.data.endDate !== undefined ? parsed.data.endDate : before.endDate),
      )
      : Boolean(before.startDate && before.endDate))

  let startDate: Date | null = before.startDate
  let endDate: Date | null = before.endDate
  let autoRenew = parsed.data.autoRenew ?? before.autoRenew

  if (hasPeriod === false || parsed.data.hasPeriod === false) {
    startDate = null
    endDate = null
    autoRenew = false
  } else {
    if (parsed.data.startDate !== undefined) {
      const parsedStart = parseOptionalDate(parsed.data.startDate)
      if (parsed.data.startDate && parsedStart === null) {
        return NextResponse.json({ error: '开始日期格式不正确。' }, { status: 400 })
      }
      startDate = parsedStart ?? null
    }
    if (parsed.data.endDate !== undefined) {
      const parsedEnd = parseOptionalDate(parsed.data.endDate)
      if (parsed.data.endDate && parsedEnd === null) {
        return NextResponse.json({ error: '结束日期格式不正确。' }, { status: 400 })
      }
      endDate = parsedEnd ?? null
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: '有服务周期时，开始与结束日期不能为空。' }, { status: 400 })
    }
    if (endDate <= startDate) {
      return NextResponse.json({ error: '结束日期必须晚于开始日期。' }, { status: 400 })
    }
  }

  const project = await prisma.advProject.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.projectType !== undefined ? { projectType: parsed.data.projectType } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      startDate,
      endDate,
      autoRenew,
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
