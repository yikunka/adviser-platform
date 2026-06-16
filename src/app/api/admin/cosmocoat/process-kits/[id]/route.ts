import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'
import {
  applyProcessKitDelete,
  applyProcessKitUpdate,
  findPendingProcessKitChangeRequest,
  ProcessKitChangeRequestError,
  rejectPendingProcessKitChangeRequests,
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
  const isSuperAdmin = session!.user.role === 'SUPER_ADMIN'
  try {
    const [kit, pendingChangeRequest] = await Promise.all([
      getProcessKitById(id),
      isSuperAdmin ? findPendingProcessKitChangeRequest(id) : Promise.resolve(null),
    ])
    if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })
    return NextResponse.json({
      kit,
      canDirectEdit: isSuperAdmin,
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
    return NextResponse.json({ error: '仅 SUPER_ADMIN 可修改已有工艺书' }, { status: 403 })
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
    return NextResponse.json({ error: '仅 SUPER_ADMIN 可删除已有工艺书' }, { status: 403 })
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
