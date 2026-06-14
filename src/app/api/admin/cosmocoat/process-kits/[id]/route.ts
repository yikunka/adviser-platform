import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'
import {
  applyProcessKitDelete,
  applyProcessKitUpdate,
  createProcessKitChangeRequest,
  findPendingProcessKitChangeRequest,
  ProcessKitChangeRequestError,
  rejectPendingProcessKitChangeRequests,
  validateProcessKitPatch,
} from '@/lib/cosmocoat/process-kit-change-requests'
import { processKitPatchSchema } from '@/lib/cosmocoat/process-kit-patch-schema'

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id } = await params
  try {
    const [kit, pendingChangeRequest] = await Promise.all([
      getProcessKitById(id),
      findPendingProcessKitChangeRequest(id),
    ])
    if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })
    return NextResponse.json({
      kit,
      canDirectEdit: session!.user.role === 'SUPER_ADMIN',
      pendingChangeRequest: pendingChangeRequest
        ? {
            id: pendingChangeRequest.id,
            action: pendingChangeRequest.action,
            status: pendingChangeRequest.status,
            createdAt: pendingChangeRequest.createdAt.toISOString(),
            requestedBy: pendingChangeRequest.requestedBy,
          }
        : null,
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = processKitPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosProcessKit.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  if (session!.user.role !== 'SUPER_ADMIN') {
    try {
      await validateProcessKitPatch(id, parsed.data, current)
      const changeRequest = await createProcessKitChangeRequest({
        kitId: id,
        action: 'UPDATE',
        payload: parsed.data,
        requestedById: session!.user.id,
      })
      return NextResponse.json(
        {
          changeRequest,
          message: '变更已提交，等待超级管理员审批',
        },
        { status: 202 },
      )
    } catch (err) {
      if (err instanceof ProcessKitChangeRequestError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      if (isMissingTable(err)) {
        return NextResponse.json({ error: '工艺书审批表不存在，请先运行数据库迁移' }, { status: 503 })
      }
      throw err
    }
  }

  try {
    await rejectPendingProcessKitChangeRequests(id, session!.user.id, '超级管理员已直接执行变更')
    const kit = await applyProcessKitUpdate(id, parsed.data, {
      id: session!.user.id,
      name: session!.user.name ?? session!.user.email ?? null,
    })
    return NextResponse.json({ kit })
  } catch (err) {
    if (err instanceof ProcessKitChangeRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosProcessKit.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  if (session!.user.role !== 'SUPER_ADMIN') {
    try {
      const changeRequest = await createProcessKitChangeRequest({
        kitId: id,
        action: 'DELETE',
        requestedById: session!.user.id,
      })
      return NextResponse.json(
        {
          changeRequest,
          message: '删除请求已提交，等待超级管理员审批',
        },
        { status: 202 },
      )
    } catch (err) {
      if (err instanceof ProcessKitChangeRequestError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      if (isMissingTable(err)) {
        return NextResponse.json({ error: '工艺书审批表不存在，请先运行数据库迁移' }, { status: 503 })
      }
      throw err
    }
  }

  try {
    await rejectPendingProcessKitChangeRequests(id, session!.user.id, '超级管理员已直接执行变更')
    await applyProcessKitDelete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ProcessKitChangeRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
