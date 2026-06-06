import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import {
  buildLineCreates,
  generateSampleOrderCode,
  getSampleOrderById,
  sampleOrderListInclude,
  serializeSampleOrderListRow,
  validateColorFormulaIds,
  validateCustomerId,
  validateProcessKitIds,
} from '@/lib/cosmocoat/sample-orders'

const orderSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  customerId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).optional().default(''),
  processKits: z.array(z.object({
    processKitId: z.string().trim().min(1),
    quantityKg: z.coerce.number().min(0.001),
    sortOrder: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(500).optional().default(''),
  })).optional().default([]),
  colorFormulas: z.array(z.object({
    colorFormulaId: z.string().trim().min(1),
    quantityKg: z.coerce.number().min(0.001),
    sortOrder: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(500).optional().default(''),
  })).optional().default([]),
  status: z.enum(['DRAFT', 'IN_PROGRESS']).optional().default('DRAFT'),
}).refine(
  data => data.processKits.length > 0 || data.colorFormulas.length > 0,
  { message: 'At least one process kit or color formula is required' },
)

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const status = req.nextUrl.searchParams.get('status')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '50') || 50))
  const skip = (page - 1) * limit

  const where: Prisma.CosSampleOrderWhereInput = {
    ...(status === 'DRAFT' || status === 'IN_PROGRESS' || status === 'COMPLETED'
      ? { status }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            { customer: { code: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  try {
    const [total, items] = await Promise.all([
      prisma.cosSampleOrder.count({ where }),
      prisma.cosSampleOrder.findMany({
        where,
        include: sampleOrderListInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({
      items: items.map(serializeSampleOrderListRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '打样单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSampleOrders' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = orderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const processKitIds = parsed.data.processKits.map(row => row.processKitId)
  const colorFormulaIds = parsed.data.colorFormulas.map(row => row.colorFormulaId)

  if (new Set(processKitIds).size !== processKitIds.length) {
    return NextResponse.json({ error: '工艺书不能重复添加' }, { status: 400 })
  }
  if (new Set(colorFormulaIds).size !== colorFormulaIds.length) {
    return NextResponse.json({ error: '调色配方不能重复添加' }, { status: 400 })
  }

  try {
    await validateCustomerId(parsed.data.customerId)
    await validateProcessKitIds(processKitIds)
    await validateColorFormulaIds(colorFormulaIds)

    const code = parsed.data.code?.trim() || await generateSampleOrderCode()
    const existing = await prisma.cosSampleOrder.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '打样单编号已存在' }, { status: 409 })

    const lines = [
      ...parsed.data.processKits.map((row, index) => ({
        processKitId: row.processKitId,
        quantityKg: row.quantityKg,
        sortOrder: row.sortOrder ?? index,
        notes: row.notes,
      })),
      ...parsed.data.colorFormulas.map((row, index) => ({
        colorFormulaId: row.colorFormulaId,
        quantityKg: row.quantityKg,
        sortOrder: row.sortOrder ?? parsed.data.processKits.length + index,
        notes: row.notes,
      })),
    ]

    const { processKitCreates, colorFormulaCreates } = buildLineCreates(lines)

    const order = await prisma.cosSampleOrder.create({
      data: {
        code,
        customerId: parsed.data.customerId,
        notes: parsed.data.notes,
        status: parsed.data.status,
        startedAt: parsed.data.status === 'IN_PROGRESS' ? new Date() : null,
        createdById: session!.user.id,
        ...(processKitCreates.length > 0
          ? { processKits: { create: processKitCreates } }
          : {}),
        ...(colorFormulaCreates.length > 0
          ? { colorFormulas: { create: colorFormulaCreates } }
          : {}),
      },
    })

    const full = await getSampleOrderById(order.id)
    return NextResponse.json({ order: full }, { status: 201 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'CUSTOMER_NOT_FOUND') {
        return NextResponse.json({ error: '客户不存在' }, { status: 400 })
      }
      if (err.message === 'PROCESS_KIT_NOT_FOUND') {
        return NextResponse.json({ error: '工艺书不存在' }, { status: 400 })
      }
      if (err.message === 'COLOR_FORMULA_NOT_FOUND') {
        return NextResponse.json({ error: '调色配方不存在' }, { status: 400 })
      }
    }
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '打样单表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
