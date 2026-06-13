import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { getFactoryProductById, syncProductRecipes } from '@/lib/cosmocoat/factory-products'
import { syncFactoryProductViscosityFromCurrentRecipe } from '@/lib/cosmocoat/factory-product-viscosity-sync'
import { refreshAllFormulaIsUsedCache } from '@/lib/cosmocoat/recipe-usage'
import { refreshRecipeCostsForFactoryProducts } from '@/lib/cosmocoat/recipe-cost-refresh'
import { syncProcessKitProductsForFactoryProduct } from '@/lib/cosmocoat/process-kit-product-sync'
import {
  factoryViscosityFieldsSchema,
  mergeFactoryViscosityPatch,
  type FactoryProductViscosityRecord,
} from '@/lib/cosmocoat/factory-product-viscosity'

const patchSchema = z.object({
  productCode: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  unit: z.string().trim().min(1).max(16).optional(),
  unitPrice: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
  recipeIds: z.array(z.string().trim().min(1)).optional(),
  currentRecipeId: z.string().trim().min(1).nullable().optional(),
  ...factoryViscosityFieldsSchema,
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const { id } = await params
  try {
    const product = await getFactoryProductById(id)
    if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 })
    return NextResponse.json({ product })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableFactoryProduct.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  if (parsed.data.productCode && parsed.data.productCode !== current.productCode) {
    const conflict = await prisma.cosTableFactoryProduct.findUnique({
      where: { productCode: parsed.data.productCode },
    })
    if (conflict) return NextResponse.json({ error: '产品编号已存在' }, { status: 409 })
  }

  try {
    if (parsed.data.categoryId) {
      const category = await prisma.cosTableProductCategory.findUnique({
        where: { id: parsed.data.categoryId },
      })
      if (!category) {
        return NextResponse.json({ error: '产品类别不存在' }, { status: 400 })
      }
    }

    if (parsed.data.recipeIds !== undefined || parsed.data.currentRecipeId !== undefined) {
      const links = await prisma.cosTableProductRecipe.findMany({
        where: { productId: id },
        select: { recipeId: true },
      })
      const recipeIds = parsed.data.recipeIds ?? links.map(link => link.recipeId)
      const currentRecipeId = parsed.data.currentRecipeId !== undefined
        ? parsed.data.currentRecipeId
        : current.currentRecipeId
      try {
        await syncProductRecipes(id, recipeIds, currentRecipeId)
      } catch (e) {
        if (e instanceof Error && e.message === 'RECIPE_NOT_FOUND') {
          return NextResponse.json({ error: '关联的配方不存在' }, { status: 400 })
        }
        throw e
      }
    }

    const {
      viscosity,
      viscosityUnit,
      recipeIds: _recipeIds,
      currentRecipeId: _currentRecipeId,
      ...patchRest
    } = parsed.data
    const viscosityKeys = ['viscosity', 'viscosityUnit'] as const
    const hasViscosityUpdate =
      body != null
      && typeof body === 'object'
      && viscosityKeys.some(key => key in body)
    const recipeLinkChanged =
      parsed.data.recipeIds !== undefined || parsed.data.currentRecipeId !== undefined

    const currentUnitPrice = current.unitPrice != null ? Number(current.unitPrice) : null
    const unitPriceChanged =
      parsed.data.unitPrice !== undefined
      && currentUnitPrice !== parsed.data.unitPrice

    const updatedAfterRecipeSync = recipeLinkChanged
      ? await prisma.cosTableFactoryProduct.findUnique({ where: { id } })
      : current
    const hasCurrentRecipe = !!updatedAfterRecipeSync?.currentRecipeId

    await prisma.cosTableFactoryProduct.update({
      where: { id },
      data: {
        ...patchRest,
        ...(hasCurrentRecipe
          ? {}
          : hasViscosityUpdate
            ? mergeFactoryViscosityPatch(current as FactoryProductViscosityRecord, {
                viscosity,
                viscosityUnit,
              })
            : {}),
      } as Prisma.CosTableFactoryProductUncheckedUpdateInput,
    })

    if (hasCurrentRecipe) {
      await syncFactoryProductViscosityFromCurrentRecipe(id)
    }

    if (unitPriceChanged) {
      await refreshRecipeCostsForFactoryProducts([id])
    }

    await syncProcessKitProductsForFactoryProduct(id)

    const product = await getFactoryProductById(id)
    return NextResponse.json({ product })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '产品表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatFactoryProducts' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableFactoryProduct.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '产品不存在' }, { status: 404 })

  await prisma.cosTableFactoryProduct.delete({ where: { id } })
  await refreshAllFormulaIsUsedCache()
  return NextResponse.json({ success: true })
}
