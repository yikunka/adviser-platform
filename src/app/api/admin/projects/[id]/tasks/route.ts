import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertAdvProjectAccessible,
  expireOverdueProjects,
} from '@/lib/adviser/projects'

const createSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(5000).optional().nullable(),
})

type RouteContext = { params: Promise<{ id: string }> }

async function assertProjectAccess(projectId: string, userId: string, role: UserRole) {
  await expireOverdueProjects([projectId])
  const project = await prisma.advProject.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true, keyPersonId: true, customerType: true },
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
  const { project, forbidden } = await assertProjectAccess(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!project) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  const tasks = await prisma.advProjectTask.findMany({
    where: { projectId: id },
    orderBy: [{ status: 'asc' }, { registeredAt: 'desc' }],
    include: {
      createdBy: { select: { nameEn: true } },
      completedBy: { select: { nameEn: true } },
    },
  })

  return NextResponse.json({
    tasks: tasks.map(task => ({
      ...task,
      registeredAt: task.registeredAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id } = await context.params
  const { project, forbidden } = await assertProjectAccess(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!project) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const task = await prisma.advProjectTask.create({
    data: {
      projectId: id,
      title: parsed.data.title.trim(),
      notes: parsed.data.notes?.trim() || null,
      createdById: session!.user.id,
    },
    include: {
      createdBy: { select: { nameEn: true } },
      completedBy: { select: { nameEn: true } },
    },
  })

  await logAudit(session!.user.id, 'CREATE', 'AdvProjectTask', task.id, null, task)
  return NextResponse.json({
    task: {
      ...task,
      registeredAt: task.registeredAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    },
    toast: '工作事项已登记。',
  }, { status: 201 })
}
