import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(['OPEN', 'DONE', 'CANCELLED']).optional(),
})

type RouteContext = { params: Promise<{ id: string; taskId: string }> }

async function loadTask(projectId: string, taskId: string, userId: string, role: UserRole) {
  const task = await prisma.advProjectTask.findFirst({
    where: { id: taskId, projectId },
    include: { project: { select: { companyId: true } } },
  })
  if (!task) return { task: null as null, forbidden: false }

  const access = await resolveCompanyAccess(userId, role)
  if (!(await assertCompanyAccessible(access, task.project.companyId))) {
    return { task: null, forbidden: true }
  }
  return { task, forbidden: false }
}

function serializeTask<T extends {
  registeredAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}>(task: T) {
  return {
    ...task,
    registeredAt: task.registeredAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id, taskId } = await context.params
  const { task: before, forbidden } = await loadTask(id, taskId, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!before) return NextResponse.json({ error: '工作事项不存在。' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const nextStatus = parsed.data.status
  const task = await prisma.advProjectTask.update({
    where: { id: taskId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() || null } : {}),
      ...(nextStatus !== undefined
        ? {
            status: nextStatus,
            completedAt: nextStatus === 'DONE' ? new Date() : null,
            completedById: nextStatus === 'DONE' ? session!.user.id : null,
          }
        : {}),
    },
    include: {
      createdBy: { select: { nameEn: true } },
      completedBy: { select: { nameEn: true } },
    },
  })

  await logAudit(session!.user.id, 'UPDATE', 'AdvProjectTask', task.id, before, task)
  return NextResponse.json({
    task: serializeTask(task),
    toast: nextStatus === 'DONE' ? '工作事项已完成。' : '工作事项已更新。',
  })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.delete')
  if (error) return error

  const { id, taskId } = await context.params
  const { task: before, forbidden } = await loadTask(id, taskId, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!before) return NextResponse.json({ error: '工作事项不存在。' }, { status: 404 })

  await prisma.advProjectTask.delete({ where: { id: taskId } })
  await logAudit(session!.user.id, 'DELETE', 'AdvProjectTask', taskId, before, null)
  return NextResponse.json({ toast: '工作事项已删除。' })
}
