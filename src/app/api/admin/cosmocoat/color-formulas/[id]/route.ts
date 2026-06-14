import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, type CosColorFormulaCategory } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { isColorFormulaCategory } from '@/lib/cosmocoat/color-formula-categories'
import { validateColorFormulaFactoryProduct } from '@/lib/cosmocoat/color-formula-factory-products'
import {
  enrichColorFormulaItemsFromRawMaterials,
  getColorFormulaById,
  saveColorFormulaItems,
  saveColorFormulaSampleOrders,
  type ColorFormulaSampleOrderLineInput,
  type ColorFormulaItemInput,
} from '@/lib/cosmocoat/color-formulas'

const itemSchema = z.object({
  rawMaterialId: z.string().trim().min(1).nullable().optional(),
  productSemifinishedId: z.string().trim().min(1).nullable().optional(),
  productionCode: z.string().trim().max(64).optional().default(''),
  name: z.string().trim().max(500).optional().default(''),
  attributeCode: z.string().trim().max(64).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  quantity: z.coerce.number().min(0),
  actualWeight: z.coerce.number().min(0).nullable().optional(),
  unitPrice: z.coerce.number().nullable().optional(),
  notes: z.string().trim().max(500).optional().default(''),
}).refine(item => !(item.rawMaterialId && item.productSemifinishedId), {
  message: '每条明细不能同时选择原料和半成品',
})

const sampleOrderSchema = z.object({
  sampleOrderId: z.string().trim().min(1),
  quantityKg: z.coerce.number().min(0.001).optional().default(1),
  sortOrder: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().max(500).optional().default(''),
})

const patchSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().min(1).optional(),
  factoryProductId: z.string().trim().min(1).nullable().optional(),
  colorCode: z.string().trim().max(64).optional(),
  customerId: z.string().trim().min(1).nullable().optional(),
  customerName: z.string().trim().max(120).optional(),
  technicalOwnerId: z.string().trim().min(1).nullable().optional(),
  targetColor: z.string().trim().max(120).optional(),
  batchQuantity: z.coerce.number().min(0.001).optional(),
  notes: z.string().trim().max(2000).optional(),
  sampleOrders: z.array(sampleOrderSchema).optional(),
  items: z.array(itemSchema).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const { id } = await params
  try {
    const formula = await getColorFormulaById(id)
    if (!formula) return NextResponse.json({ error: '调色配方不存在' }, { status: 404 })
    return NextResponse.json({ formula })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.category && !isColorFormulaCategory(parsed.data.category)) {
    return NextResponse.json({ error: '无效的配方类别' }, { status: 400 })
  }

  const current = await prisma.cosTableColorFormula.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '调色配方不存在' }, { status: 404 })
  const sampleOrderIds = parsed.data.sampleOrders?.map(line => line.sampleOrderId) ?? []

  if (parsed.data.code && parsed.data.code !== current.code) {
    const conflict = await prisma.cosTableColorFormula.findUnique({ where: { code: parsed.data.code } })
    if (conflict) return NextResponse.json({ error: '配方编号已存在' }, { status: 409 })
  }

  const nextCategory = (parsed.data.category ?? current.category) as CosColorFormulaCategory
  const factoryProductProvided = parsed.data.factoryProductId !== undefined
  const factoryProductIdForValidation = factoryProductProvided
    ? parsed.data.factoryProductId
    : parsed.data.category !== undefined
      ? null
      : current.factoryProductId

  const productCheck = await validateColorFormulaFactoryProduct({
    category: nextCategory,
    factoryProductId: factoryProductIdForValidation,
  })
  if (!productCheck.ok) {
    return NextResponse.json({ error: productCheck.error }, { status: 400 })
  }

  const customer = parsed.data.customerId
    ? await prisma.cosCustomer.findUnique({
        where: { id: parsed.data.customerId },
        select: { id: true, name: true },
      })
    : null
  if (parsed.data.customerId && !customer) {
    return NextResponse.json({ error: '所选客户不存在' }, { status: 400 })
  }

  const technicalOwner = parsed.data.technicalOwnerId
    ? await prisma.cosEmployee.findFirst({
        where: { id: parsed.data.technicalOwnerId, employeeType: 'TECHNICAL' },
        select: { id: true },
      })
    : null
  if (parsed.data.technicalOwnerId && !technicalOwner) {
    return NextResponse.json({ error: '所选负责人员不是技术人员或不存在' }, { status: 400 })
  }

  if (parsed.data.sampleOrders) {
    if (new Set(sampleOrderIds).size !== sampleOrderIds.length) {
      return NextResponse.json({ error: '打样单不能重复关联' }, { status: 400 })
    }
    if (sampleOrderIds.length > 0) {
      const sampleOrders = await prisma.cosSampleOrder.findMany({
        where: { id: { in: sampleOrderIds } },
        select: { id: true },
      })
      if (sampleOrders.length !== sampleOrderIds.length) {
        return NextResponse.json({ error: '所选打样单不存在' }, { status: 400 })
      }
    }
  }

  const shouldUpdateFactoryProduct =
    factoryProductProvided || (parsed.data.category !== undefined && parsed.data.category !== current.category)
  const shouldUpdateCustomer = parsed.data.customerId !== undefined
  const shouldUpdateTechnicalOwner = parsed.data.technicalOwnerId !== undefined

  try {
    const data: Prisma.CosTableColorFormulaUpdateInput = {
      ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category as CosColorFormulaCategory } : {}),
      ...(shouldUpdateFactoryProduct
        ? productCheck.factoryProductId
          ? { factoryProduct: { connect: { id: productCheck.factoryProductId } } }
          : { factoryProduct: { disconnect: true } }
        : {}),
      ...(parsed.data.colorCode !== undefined ? { colorCode: parsed.data.colorCode } : {}),
      ...(shouldUpdateCustomer
        ? customer
          ? { customer: { connect: { id: customer.id } }, customerName: customer.name }
          : {
              customer: { disconnect: true },
              customerName: parsed.data.customerName ?? '',
            }
        : parsed.data.customerName !== undefined
          ? { customerName: parsed.data.customerName }
          : {}),
      ...(shouldUpdateTechnicalOwner
        ? technicalOwner
          ? { technicalOwner: { connect: { id: technicalOwner.id } } }
          : { technicalOwner: { disconnect: true } }
        : {}),
      ...(parsed.data.targetColor !== undefined ? { targetColor: parsed.data.targetColor } : {}),
      ...(parsed.data.batchQuantity !== undefined ? { batchQuantity: parsed.data.batchQuantity } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    }

    await prisma.cosTableColorFormula.update({
      where: { id },
      data,
    })

    if (parsed.data.items) {
      const enriched = await enrichColorFormulaItemsFromRawMaterials(parsed.data.items as ColorFormulaItemInput[])
      const batchQuantity = parsed.data.batchQuantity ?? Number(current.batchQuantity)
      await saveColorFormulaItems(id, enriched, batchQuantity)
    }
    if (parsed.data.sampleOrders) {
      const sampleOrderLines: ColorFormulaSampleOrderLineInput[] = parsed.data.sampleOrders.map((line, index) => ({
        sampleOrderId: line.sampleOrderId,
        quantityKg: line.quantityKg,
        sortOrder: line.sortOrder ?? index,
        notes: line.notes,
      }))
      await saveColorFormulaSampleOrders(id, sampleOrderLines)
    }

    const full = await getColorFormulaById(id)
    return NextResponse.json({ formula: full })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableColorFormula.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '调色配方不存在' }, { status: 404 })

  try {
    await prisma.cosTableColorFormula.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '调色配方表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
