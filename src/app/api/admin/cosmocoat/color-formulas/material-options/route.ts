import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

const SEMIFINISHED_TYPE_KEYS = new Set(['Sol', 'Sol.', 'product_semifinished'])

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatColorFormulas' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const types = req.nextUrl.searchParams.getAll('type').map(type => type.trim()).filter(Boolean)
  const limit = Math.min(120, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '60') || 60))
  const rawTypes = types.filter(type => !SEMIFINISHED_TYPE_KEYS.has(type))
  const includeSemifinished = types.length === 0 || types.some(type => SEMIFINISHED_TYPE_KEYS.has(type))

  const rawWhere: Prisma.CosTableRawMaterialWhereInput = {
    ...(rawTypes.length > 0 ? { attributeCode: { in: rawTypes } } : {}),
    ...(q
      ? {
          OR: [
            { productionCode: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { attributeCode: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { huaxingCode: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const semifinishedWhere: Prisma.CosTableProductSemifinishedWhereInput = {
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  try {
    const [rawMaterials, semifinishedProducts] = await Promise.all([
      prisma.cosTableRawMaterial.findMany({
        where: rawWhere,
        orderBy: [{ attributeCode: 'asc' }, { productionCode: 'asc' }],
        take: limit,
        select: {
          id: true,
          productionCode: true,
          name: true,
          attributeCode: true,
          category: true,
          primaryPackageKg: true,
          primaryPricePerKg: true,
          primaryNotes: true,
        },
      }),
      includeSemifinished
        ? prisma.cosTableProductSemifinished.findMany({
            where: semifinishedWhere,
            orderBy: [{ category: 'asc' }, { code: 'asc' }],
            take: limit,
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              unitPrice: true,
            },
          })
        : [],
    ])

    const items = [
      ...rawMaterials.map(item => ({
        optionType: 'raw_material' as const,
        id: item.id,
        productionCode: item.productionCode,
        name: item.name,
        attributeCode: item.attributeCode,
        category: item.category,
        primaryPackageKg: item.primaryPackageKg != null ? Number(item.primaryPackageKg) : null,
        primaryPricePerKg: item.primaryPricePerKg != null ? Number(item.primaryPricePerKg) : null,
        primaryNotes: item.primaryNotes,
      })),
      ...semifinishedProducts.map(item => ({
        optionType: 'product_semifinished' as const,
        id: item.id,
        productionCode: item.code,
        name: item.name,
        attributeCode: 'Sol',
        category: item.category,
        primaryPackageKg: null,
        primaryPricePerKg: item.unitPrice != null ? Number(item.unitPrice) : null,
        primaryNotes: '',
      })),
    ].slice(0, limit)

    return NextResponse.json({ items })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '原料或半成品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
