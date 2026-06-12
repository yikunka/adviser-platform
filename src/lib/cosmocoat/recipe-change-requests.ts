import type {
  CosTableRecipe,
  CosTableRecipeChangeAction,
  CosTableRecipeChangeRequest,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import { refreshRecipeCostsCascade } from '@/lib/cosmocoat/recipe-cost-refresh'
import { recipeItemToPrismaCreate } from '@/lib/cosmocoat/recipe-items'
import { RecipeItemValidationError, validateAndEnrichRecipeItems } from '@/lib/cosmocoat/recipe-item-validation'
import { type RecipePatchInput } from '@/lib/cosmocoat/recipe-patch-schema'
import { serializeFullRecipe } from '@/lib/cosmocoat/recipe-serializer'
import { refreshAllFormulaIsUsedCache } from '@/lib/cosmocoat/recipe-usage'
import { computeItemAmount, computeRecipeTotals, normalizeRecipeItems } from '@/lib/cosmocoat/recipes'
import { mergeRecipeViscosityPatch } from '@/lib/cosmocoat/recipe-viscosity'
import { syncFactoryProductsViscosityFromRecipe } from '@/lib/cosmocoat/factory-product-viscosity-sync'

const changeRequestInclude = {
  recipe: {
    select: {
      id: true,
      code: true,
      name: true,
      category: { select: { id: true, code: true, name: true } },
    },
  },
  requestedBy: { select: { id: true, nameEn: true, email: true } },
  reviewedBy: { select: { id: true, nameEn: true, email: true } },
} satisfies Prisma.CosTableRecipeChangeRequestInclude

export type SerializedRecipeChangeRequest = {
  id: string
  recipeId: string
  action: CosTableRecipeChangeAction
  payload: unknown
  status: CosTableRecipeChangeRequest['status']
  requestNote: string
  reviewNote: string
  requestedById: string
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  recipe: {
    id: string
    code: string
    name: string
    category: { id: string; code: string; name: string }
  }
  requestedBy: { id: string; nameEn: string | null; email: string }
  reviewedBy: { id: string; nameEn: string | null; email: string } | null
}

export function serializeRecipeChangeRequest(
  row: Prisma.CosTableRecipeChangeRequestGetPayload<{ include: typeof changeRequestInclude }>,
): SerializedRecipeChangeRequest {
  return {
    id: row.id,
    recipeId: row.recipeId,
    action: row.action,
    payload: row.payload ?? null,
    status: row.status,
    requestNote: row.requestNote,
    reviewNote: row.reviewNote,
    requestedById: row.requestedById,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    recipe: row.recipe,
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
  }
}

export async function findPendingRecipeChangeRequest(recipeId: string) {
  return prisma.cosTableRecipeChangeRequest.findFirst({
    where: { recipeId, status: 'PENDING' },
    include: changeRequestInclude,
  })
}

export async function createRecipeChangeRequest(input: {
  recipeId: string
  action: CosTableRecipeChangeAction
  payload?: RecipePatchInput | null
  requestedById: string
  requestNote?: string
}) {
  const pending = await findPendingRecipeChangeRequest(input.recipeId)
  if (pending) {
    throw new RecipeChangeRequestError('该配方已有待审批的变更请求，请等待超级管理员处理后再提交', 409)
  }

  const row = await prisma.cosTableRecipeChangeRequest.create({
    data: {
      recipeId: input.recipeId,
      action: input.action,
      payload: input.payload != null ? (input.payload as Prisma.InputJsonValue) : undefined,
      requestedById: input.requestedById,
      requestNote: input.requestNote?.trim() ?? '',
    },
    include: changeRequestInclude,
  })

  await logAudit(
    input.requestedById,
    'RECIPE_CHANGE_REQUEST_CREATE',
    'CosTableRecipeChangeRequest',
    row.id,
    undefined,
    { recipeId: input.recipeId, action: input.action },
  )

  return serializeRecipeChangeRequest(row)
}

export class RecipeChangeRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'RecipeChangeRequestError'
  }
}

export async function validateRecipePatch(recipeId: string, data: RecipePatchInput, current: CosTableRecipe) {
  if (data.code && data.code !== current.code) {
    const conflict = await prisma.cosTableRecipe.findUnique({ where: { code: data.code } })
    if (conflict) throw new RecipeChangeRequestError('配方编号已存在', 409)
  }

  if (data.categoryId) {
    const category = await prisma.cosTableRecipeCategory.findUnique({ where: { id: data.categoryId } })
    if (!category) throw new RecipeChangeRequestError('目录不存在', 404)
  }

  if (data.items) {
    await validateAndEnrichRecipeItems(data.items, recipeId)
  }
}

export async function rejectPendingRecipeChangeRequests(recipeId: string, reviewerId: string, reviewNote: string) {
  await prisma.cosTableRecipeChangeRequest.updateMany({
    where: { recipeId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote,
    },
  })
}

export async function applyRecipeUpdate(
  recipeId: string,
  data: RecipePatchInput,
  rawBody?: unknown,
) {
  const current = await prisma.cosTableRecipe.findUnique({ where: { id: recipeId } })
  if (!current) throw new RecipeChangeRequestError('配方不存在', 404)

  await validateRecipePatch(recipeId, data, current)

  if (data.refreshPrices) {
    await refreshRecipeCostsCascade([recipeId])
    await refreshAllFormulaIsUsedCache()
    return serializeFullRecipe(recipeId)
  }

  if (data.items) {
    const enriched = await validateAndEnrichRecipeItems(data.items, recipeId)
    const batchQty = data.batchQuantity ?? Number(current.batchQuantity)
    const normalized = normalizeRecipeItems(enriched, batchQty)
    await prisma.cosTableRecipeItem.deleteMany({ where: { recipeId } })
    if (normalized.length > 0) {
      await prisma.cosTableRecipeItem.createMany({
        data: normalized.map(item => recipeItemToPrismaCreate(recipeId, item)),
      })
    }
  }

  const batchQuantity = data.batchQuantity ?? Number(current.batchQuantity)
  const items = await prisma.cosTableRecipeItem.findMany({ where: { recipeId } })
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0)
  const totals = computeRecipeTotals(
    items.map(item => {
      const quantity = Number(item.quantity)
      const unitPrice = item.unitPrice != null ? Number(item.unitPrice) : null
      return {
        quantity,
        unitPrice,
        amount: computeItemAmount(quantity, unitPrice, totalQuantity, batchQuantity),
      }
    }),
    batchQuantity,
  )

  const viscosityKeys = ['viscosity', 'viscosityUnit'] as const
  const hasViscosityUpdate =
    rawBody != null
    && typeof rawBody === 'object'
    && viscosityKeys.some(key => key in rawBody)

  await prisma.cosTableRecipe.update({
    where: { id: recipeId },
    data: {
      categoryId: data.categoryId,
      code: data.code,
      name: data.name,
      batchQuantity: data.batchQuantity,
      ...(data.viscosity !== undefined || data.viscosityUnit !== undefined
        ? mergeRecipeViscosityPatch(current, data)
        : {}),
      shelfLifeDays: data.shelfLifeDays,
      notes: data.notes,
      productionSpeedRequirements: data.productionSpeedRequirements,
      productionTimeRequirements: data.productionTimeRequirements,
      packagingRequirements: data.packagingRequirements,
      productionNotes: data.productionNotes,
      qcTestStandard: data.qcTestStandard,
      qcTestItems: data.qcTestItems,
      qcResult: data.qcResult,
      unitCost: totals.unitCost,
    },
  })

  if (hasViscosityUpdate) {
    await syncFactoryProductsViscosityFromRecipe(recipeId)
  }

  await refreshAllFormulaIsUsedCache()
  return serializeFullRecipe(recipeId)
}

export async function applyRecipeDelete(recipeId: string) {
  const current = await prisma.cosTableRecipe.findUnique({ where: { id: recipeId } })
  if (!current) throw new RecipeChangeRequestError('配方不存在', 404)

  await prisma.cosTableRecipe.delete({ where: { id: recipeId } })
  await refreshAllFormulaIsUsedCache()
}

export async function reviewRecipeChangeRequest(input: {
  requestId: string
  reviewerId: string
  action: 'APPROVE' | 'REJECT'
  reviewNote?: string
}) {
  const row = await prisma.cosTableRecipeChangeRequest.findUnique({
    where: { id: input.requestId },
    include: changeRequestInclude,
  })
  if (!row) throw new RecipeChangeRequestError('审批请求不存在', 404)
  if (row.status !== 'PENDING') {
    throw new RecipeChangeRequestError('该审批请求已处理', 409)
  }

  if (input.action === 'REJECT') {
    const updated = await prisma.cosTableRecipeChangeRequest.update({
      where: { id: row.id },
      data: {
        status: 'REJECTED',
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() ?? '',
      },
      include: changeRequestInclude,
    })

    await logAudit(
      input.reviewerId,
      'RECIPE_CHANGE_REQUEST_REJECT',
      'CosTableRecipeChangeRequest',
      row.id,
      row,
      updated,
    )

    return serializeRecipeChangeRequest(updated)
  }

  const payload = (row.payload ?? {}) as RecipePatchInput
  if (row.action === 'DELETE') {
    await applyRecipeDelete(row.recipeId)
  } else {
    try {
      await applyRecipeUpdate(row.recipeId, payload, payload)
    } catch (err) {
      if (err instanceof RecipeItemValidationError) {
        throw new RecipeChangeRequestError(err.message, 400)
      }
      throw err
    }
  }

  const updated = await prisma.cosTableRecipeChangeRequest.update({
    where: { id: row.id },
    data: {
      status: 'APPROVED',
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() ?? '',
    },
    include: changeRequestInclude,
  })

  await logAudit(
    input.reviewerId,
    'RECIPE_CHANGE_REQUEST_APPROVE',
    'CosTableRecipeChangeRequest',
    row.id,
    row,
    updated,
  )

  return serializeRecipeChangeRequest(updated)
}

export async function listRecipeChangeRequests(opts?: {
  status?: CosTableRecipeChangeRequest['status']
  recipeId?: string
  limit?: number
}) {
  const status = opts?.status ?? 'PENDING'
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 50))

  const rows = await prisma.cosTableRecipeChangeRequest.findMany({
    where: {
      status,
      ...(opts?.recipeId ? { recipeId: opts.recipeId } : {}),
    },
    include: changeRequestInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  })

  return rows.map(serializeRecipeChangeRequest)
}
