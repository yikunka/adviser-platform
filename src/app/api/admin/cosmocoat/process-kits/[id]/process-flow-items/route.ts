import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'
import { rejectPendingProcessKitChangeRequests } from '@/lib/cosmocoat/process-kit-change-requests'
import { normalizeProcessFlowItems, processFlowItemsForDb } from '@/lib/cosmocoat/process-flow'

const processFlowItemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().trim().min(1).max(80),
    type: z.literal('product'),
    kitProductId: z.string().trim().min(1),
  }),
  z.object({
    id: z.string().trim().min(1).max(80),
    type: z.literal('process'),
    text: z.string().trim().min(1).max(2000),
  }),
])

const patchSchema = z.object({
  items: z.array(processFlowItemSchema).max(200),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error
  if (session!.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '非超级管理员请在详情页提交审批，不能直接修改工艺流程' }, { status: 403 })
  }

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({
    where: { id: kitId },
    include: { products: { select: { id: true } } },
  })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const validProductIds = new Set(kit.products.map(product => product.id))
  for (const item of parsed.data.items) {
    if (item.type === 'product' && !validProductIds.has(item.kitProductId)) {
      return NextResponse.json({ error: '工艺流程中包含不存在的产品明细' }, { status: 400 })
    }
  }

  try {
    await rejectPendingProcessKitChangeRequests(kitId, session!.user.id, '超级管理员已直接执行变更')
    await prisma.cosProcessKit.update({
      where: { id: kitId },
      data: {
        processFlowItems: processFlowItemsForDb(normalizeProcessFlowItems(parsed.data.items)),
        updatedBy: session!.user.id,
        updatedByName: session!.user.name ?? session!.user.email ?? null,
      },
    })

    const full = await getProcessKitById(kitId)
    return NextResponse.json({ kit: full })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
