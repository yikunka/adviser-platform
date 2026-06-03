import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'

const productSchema = z.object({
  productId: z.string().trim().min(1),
  productName: z.string().trim().min(1).max(160).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  quantityRatio: z.string().trim().max(64).optional().default(''),
  usageMethod: z.string().trim().min(1).max(2000),
  irMinutes: z.coerce.number().min(0).max(9999).nullable().optional(),
  irTemperature: z.coerce.number().min(0).max(9999).nullable().optional(),
  uvEnergy: z.coerce.number().min(0).max(999999).nullable().optional(),
  notes: z.string().trim().max(2000).optional().default(''),
})

const deleteSchema = z.object({
  id: z.string().trim().min(1),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

async function resolveProductName(productId: string, productName?: string) {
  if (productName?.trim()) return productName.trim()
  const factoryProduct = await prisma.cosTableFactoryProduct.findUnique({
    where: { id: productId },
    select: { productCode: true, name: true },
  })
  if (factoryProduct) return `${factoryProduct.productCode} · ${factoryProduct.name}`
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const resolvedName = await resolveProductName(parsed.data.productId, parsed.data.productName)
    if (!resolvedName) {
      return NextResponse.json({ error: '产品不存在，请提供有效的产品 ID 或产品名称' }, { status: 400 })
    }

    const maxSort = await prisma.cosProcessKitProduct.aggregate({
      where: { kitId },
      _max: { sortOrder: true },
    })
    const sortOrder = parsed.data.sortOrder ?? ((maxSort._max.sortOrder ?? -1) + 1)

    await prisma.cosProcessKitProduct.create({
      data: {
        kitId,
        productId: parsed.data.productId,
        productName: resolvedName,
        sortOrder,
        quantityRatio: parsed.data.quantityRatio || null,
        usageMethod: parsed.data.usageMethod,
        irMinutes: parsed.data.irMinutes ?? null,
        irTemperature: parsed.data.irTemperature ?? null,
        uvEnergy: parsed.data.uvEnergy ?? null,
        notes: parsed.data.notes || null,
      },
    })

    const full = await getProcessKitById(kitId)
    return NextResponse.json({ kit: full }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '工艺书表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatProcessKits' })
  if (error) return error

  const { id: kitId } = await params
  const kit = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!kit) return NextResponse.json({ error: '工艺书不存在' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.cosProcessKitProduct.findFirst({
    where: { id: parsed.data.id, kitId },
  })
  if (!product) return NextResponse.json({ error: '产品明细不存在' }, { status: 404 })

  await prisma.cosProcessKitProduct.delete({ where: { id: parsed.data.id } })
  const full = await getProcessKitById(kitId)
  return NextResponse.json({ kit: full })
}
