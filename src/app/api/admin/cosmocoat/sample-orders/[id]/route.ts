import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildLineCreates,
  getSampleOrderById,
  isValidStatusTransition,
  validateColorFormulaIds,
  validateCustomerId,
  validateProcessKitIds,
  validateSampleOrderEmployeeId,
} from '@/lib/cosmocoat/sample-orders'

const nullableIdSchema = z.preprocess(
  value => value === '' ? null : value,
  z.string().trim().min(1).nullable().optional(),
)

const patchSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  salesEmployeeId: nullableIdSchema,
  technicalEmployeeId: nullableIdSchema,
  isUrgent: z.coerce.boolean().optional(),
  sampleKind: z.string().trim().max(50).optional(),
  substrateType: z.string().trim().max(200).optional(),
  samplePanelRequirement: z.string().trim().max(1000).optional(),
  sampleOilRequirement: z.string().trim().max(1000).optional(),
  specialProcessRequirement: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  referenceImageUrl: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED']).optional(),
  processKits: z.array(z.object({
    processKitId: z.string().trim().min(1),
    quantityKg: z.coerce.number().min(0.001).optional().default(1),
    sortOrder: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(500).optional().default(''),
  })).max(1, '每个打样单只能关联一个工艺套件').optional(),
  colorFormulas: z.array(z.object({
    colorFormulaId: z.string().trim().min(1),
    quantityKg: z.coerce.number().min(0.001),
    sortOrder: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(500).optional().default(''),
  })).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const { id } = await params
  try {
    const order = await getSampleOrderById(id)
    if (!order) return NextResponse.json({ error: '打样单不存在' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '打样单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosSampleOrder.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '打样单不存在' }, { status: 404 })

  if (current.status === 'COMPLETED' && (
    parsed.data.processKits !== undefined
    || parsed.data.colorFormulas !== undefined
    || parsed.data.customerId !== undefined
    || parsed.data.salesEmployeeId !== undefined
    || parsed.data.technicalEmployeeId !== undefined
  )) {
    return NextResponse.json({ error: '已完成的打样单不可修改明细、客户或负责人' }, { status: 400 })
  }

  if (parsed.data.status && !isValidStatusTransition(current.status, parsed.data.status)) {
    return NextResponse.json({ error: '无效的状态变更' }, { status: 400 })
  }

  const replacingLines = parsed.data.processKits !== undefined || parsed.data.colorFormulas !== undefined
  if (replacingLines) {
    const processKits = parsed.data.processKits ?? []
    const colorFormulas = parsed.data.colorFormulas ?? []
    if (processKits.length === 0 && colorFormulas.length === 0) {
      return NextResponse.json({ error: '至少保留一条工艺书或调色配方明细' }, { status: 400 })
    }

    const processKitIds = processKits.map(row => row.processKitId)
    const colorFormulaIds = colorFormulas.map(row => row.colorFormulaId)
    if (new Set(processKitIds).size !== processKitIds.length) {
      return NextResponse.json({ error: '工艺书不能重复添加' }, { status: 400 })
    }
    if (new Set(colorFormulaIds).size !== colorFormulaIds.length) {
      return NextResponse.json({ error: '调色配方不能重复添加' }, { status: 400 })
    }

    try {
      await validateProcessKitIds(processKitIds)
      await validateColorFormulaIds(colorFormulaIds)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'PROCESS_KIT_NOT_FOUND') {
          return NextResponse.json({ error: '工艺书不存在' }, { status: 400 })
        }
        if (err.message === 'COLOR_FORMULA_NOT_FOUND') {
          return NextResponse.json({ error: '调色配方不存在' }, { status: 400 })
        }
      }
      throw err
    }
  }

  if (parsed.data.customerId) {
    try {
      await validateCustomerId(parsed.data.customerId)
    } catch {
      return NextResponse.json({ error: '客户不存在' }, { status: 400 })
    }
  }

  let salesEmployeeId: string | null | undefined
  let technicalEmployeeId: string | null | undefined
  try {
    if (parsed.data.salesEmployeeId !== undefined) {
      salesEmployeeId = await validateSampleOrderEmployeeId(parsed.data.salesEmployeeId, 'SALES')
    }
    if (parsed.data.technicalEmployeeId !== undefined) {
      technicalEmployeeId = await validateSampleOrderEmployeeId(parsed.data.technicalEmployeeId, 'TECHNICAL')
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'SALES_EMPLOYEE_NOT_FOUND') {
        return NextResponse.json({ error: '所选销售人员不是销售类型员工或不存在' }, { status: 400 })
      }
      if (err.message === 'TECHNICAL_EMPLOYEE_NOT_FOUND') {
        return NextResponse.json({ error: '所选负责人员不是技术类型员工或不存在' }, { status: 400 })
      }
    }
    throw err
  }

  const nextStatus = parsed.data.status ?? current.status
  const startedAt = nextStatus === 'DRAFT'
    ? null
    : current.startedAt ?? (nextStatus === 'IN_PROGRESS' || nextStatus === 'COMPLETED' ? new Date() : null)
  const completedAt = nextStatus === 'COMPLETED'
    ? current.completedAt ?? new Date()
    : nextStatus === 'DRAFT'
      ? null
      : current.completedAt

  try {
    await prisma.$transaction(async tx => {
      if (replacingLines) {
        await tx.cosSampleOrderProcessKit.deleteMany({ where: { sampleOrderId: id } })
        await tx.cosSampleOrderColorFormula.deleteMany({ where: { sampleOrderId: id } })

        const lines = [
          ...(parsed.data.processKits ?? []).map((row, index) => ({
            processKitId: row.processKitId,
            quantityKg: row.quantityKg,
            sortOrder: row.sortOrder ?? index,
            notes: row.notes,
          })),
          ...(parsed.data.colorFormulas ?? []).map((row, index) => ({
            colorFormulaId: row.colorFormulaId,
            quantityKg: row.quantityKg,
            sortOrder: row.sortOrder ?? (parsed.data.processKits?.length ?? 0) + index,
            notes: row.notes,
          })),
        ]
        const { processKitCreates, colorFormulaCreates } = buildLineCreates(lines)

        if (processKitCreates.length > 0) {
          await tx.cosSampleOrderProcessKit.createMany({
            data: processKitCreates.map(row => ({ ...row, sampleOrderId: id })),
          })
        }
        if (colorFormulaCreates.length > 0) {
          await tx.cosSampleOrderColorFormula.createMany({
            data: colorFormulaCreates.map(row => ({ ...row, sampleOrderId: id })),
          })
        }
      }

      await tx.cosSampleOrder.update({
        where: { id },
        data: {
          ...(parsed.data.customerId ? { customerId: parsed.data.customerId } : {}),
          ...(parsed.data.salesEmployeeId !== undefined ? { salesEmployeeId } : {}),
          ...(parsed.data.technicalEmployeeId !== undefined ? { technicalEmployeeId } : {}),
          ...(parsed.data.isUrgent !== undefined ? { isUrgent: parsed.data.isUrgent } : {}),
          ...(parsed.data.sampleKind !== undefined ? { sampleKind: parsed.data.sampleKind } : {}),
          ...(parsed.data.substrateType !== undefined ? { substrateType: parsed.data.substrateType } : {}),
          ...(parsed.data.samplePanelRequirement !== undefined ? { samplePanelRequirement: parsed.data.samplePanelRequirement } : {}),
          ...(parsed.data.sampleOilRequirement !== undefined ? { sampleOilRequirement: parsed.data.sampleOilRequirement } : {}),
          ...(parsed.data.specialProcessRequirement !== undefined ? { specialProcessRequirement: parsed.data.specialProcessRequirement } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.referenceImageUrl !== undefined
            ? { referenceImageUrl: parsed.data.referenceImageUrl?.trim() || null }
            : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          startedAt,
          completedAt,
        },
      })
    })

    const order = await getSampleOrderById(id)
    return NextResponse.json({ order })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: '每个打样单只能关联一个工艺套件' }, { status: 400 })
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '打样单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosSampleOrder.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '打样单不存在' }, { status: 404 })

  if (current.status === 'IN_PROGRESS') {
    return NextResponse.json({ error: '进行中的打样单不可删除，请先标记完成或保持草稿' }, { status: 400 })
  }

  try {
    await prisma.cosSampleOrder.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '打样单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
