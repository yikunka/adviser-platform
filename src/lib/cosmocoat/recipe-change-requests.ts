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
import {
  computeItemAmount,
  computeRecipeTotals,
  computeUnitCostFromItems,
  normalizeRecipeItems,
  type RecipeItemInput,
} from '@/lib/cosmocoat/recipes'
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
  changeSummary: string[]
  changeDiff: RecipeChangeDiffLine[]
}

export type RecipeChangeDiffLine = {
  section: string
  label: string
  before: string
  after: string
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
    changeSummary: [],
    changeDiff: [],
  }
}

type ChangeReviewRecipe = NonNullable<Awaited<ReturnType<typeof serializeFullRecipe>>>

type ReviewItem = {
  key: string
  label: string
  quantity: number
  unitPrice: number | null
}

function formatReviewValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '—'
  return String(value).trim() || '—'
}

function formatMoneyValue(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? '—' : value.toFixed(4)
}

function valuesDiffer(a: unknown, b: unknown) {
  if (typeof a === 'number' || typeof b === 'number') {
    const left = Number(a)
    const right = Number(b)
    if (!Number.isFinite(left) || !Number.isFinite(right)) return String(a ?? '') !== String(b ?? '')
    return Math.abs(left - right) > 1e-6
  }
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

function itemSourceKey(item: {
  itemType?: string
  rawMaterial?: { id: string } | null
  recipe?: { id: string } | null
  productSemifinished?: { id: string } | null
  factoryProduct?: { id: string } | null
}) {
  if (item.recipe) return `recipe:${item.recipe.id}`
  if (item.productSemifinished) return `product_semifinished:${item.productSemifinished.id}`
  if (item.factoryProduct) return `factory_product:${item.factoryProduct.id}`
  if (item.rawMaterial) return `raw_material:${item.rawMaterial.id}`
  return `${item.itemType ?? 'unknown'}:unknown`
}

function itemInputSourceKey(item: RecipeItemInput) {
  if (item.recipeId) return `recipe:${item.recipeId}`
  if (item.productSemifinishedId) return `product_semifinished:${item.productSemifinishedId}`
  if (item.factoryProductId) return `factory_product:${item.factoryProductId}`
  return `raw_material:${item.rawMaterialId}`
}

function currentReviewItems(recipe: ChangeReviewRecipe): ReviewItem[] {
  return recipe.items.map(item => ({
    key: itemSourceKey(item),
    label: item.recipe
      ? `${item.recipe.code} ${item.recipe.name}`
      : item.productSemifinished
        ? `${item.productSemifinished.code} ${item.productSemifinished.name}`
        : item.factoryProduct
          ? `${item.factoryProduct.productCode} ${item.factoryProduct.name}`
          : `${item.rawMaterial?.productionCode ?? '—'} ${item.rawMaterial?.name ?? '—'}`,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }))
}

async function recipeItemInputLabels(items: RecipeItemInput[]) {
  const rawMaterialIds = items.map(item => item.rawMaterialId).filter((id): id is string => Boolean(id))
  const recipeIds = items.map(item => item.recipeId).filter((id): id is string => Boolean(id))
  const productSemifinishedIds = items.map(item => item.productSemifinishedId).filter((id): id is string => Boolean(id))
  const factoryProductIds = items.map(item => item.factoryProductId).filter((id): id is string => Boolean(id))

  const [rawMaterials, recipes, semifinished, factoryProducts] = await Promise.all([
    rawMaterialIds.length > 0
      ? prisma.cosTableRawMaterial.findMany({
          where: { id: { in: rawMaterialIds } },
          select: { id: true, productionCode: true, name: true },
        })
      : Promise.resolve([]),
    recipeIds.length > 0
      ? prisma.cosTableRecipe.findMany({
          where: { id: { in: recipeIds } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    productSemifinishedIds.length > 0
      ? prisma.cosTableProductSemifinished.findMany({
          where: { id: { in: productSemifinishedIds } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    factoryProductIds.length > 0
      ? prisma.cosTableFactoryProduct.findMany({
          where: { id: { in: factoryProductIds } },
          select: { id: true, productCode: true, name: true },
        })
      : Promise.resolve([]),
  ])

  return {
    rawMaterials: new Map(rawMaterials.map(item => [item.id, `${item.productionCode} ${item.name}`])),
    recipes: new Map(recipes.map(item => [item.id, `${item.code} ${item.name}`])),
    semifinished: new Map(semifinished.map(item => [item.id, `${item.code} ${item.name}`])),
    factoryProducts: new Map(factoryProducts.map(item => [item.id, `${item.productCode} ${item.name}`])),
  }
}

async function payloadReviewItems(recipeId: string, items: RecipeItemInput[]): Promise<ReviewItem[]> {
  const enriched = await validateAndEnrichRecipeItems(items, recipeId)
  const labels = await recipeItemInputLabels(enriched)

  return enriched.map(item => ({
    key: itemInputSourceKey(item),
    label: item.recipeId
      ? (labels.recipes.get(item.recipeId) ?? item.recipeId)
      : item.productSemifinishedId
        ? (labels.semifinished.get(item.productSemifinishedId) ?? item.productSemifinishedId)
        : item.factoryProductId
          ? (labels.factoryProducts.get(item.factoryProductId) ?? item.factoryProductId)
          : (labels.rawMaterials.get(item.rawMaterialId ?? '') ?? item.rawMaterialId ?? '—'),
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? null,
  }))
}

function formatItemState(item: ReviewItem) {
  return `数量 ${formatReviewValue(item.quantity)}；单价 ${formatMoneyValue(item.unitPrice)}`
}

async function buildRecipeChangeReview(
  recipeId: string,
  action: CosTableRecipeChangeAction,
  payload: RecipePatchInput,
) {
  const summary: string[] = []
  const diff: RecipeChangeDiffLine[] = []
  const recipe = await serializeFullRecipe(recipeId)
  if (!recipe) {
    return {
      changeSummary: ['当前配方已不存在，无法生成变更对比'],
      changeDiff: [],
    }
  }

  if (action === 'DELETE') {
    return {
      changeSummary: [
        `删除配方 ${recipe.code} · ${recipe.name}`,
        `当前物料 ${recipe.items.length} 项，单位成本 ${formatMoneyValue(recipe.unitCost)}`,
      ],
      changeDiff: [{
        section: '删除',
        label: '配方记录',
        before: `${recipe.code} · ${recipe.name}`,
        after: '删除',
      }],
    }
  }

  let afterCategoryName = recipe.category.name
  if (payload.categoryId && payload.categoryId !== recipe.categoryId) {
    const category = await prisma.cosTableRecipeCategory.findUnique({
      where: { id: payload.categoryId },
      select: { code: true, name: true },
    })
    afterCategoryName = category ? `${category.code} ${category.name}` : payload.categoryId
  }

  const basicFields: Array<[keyof RecipePatchInput, string, unknown, unknown]> = [
    ['code', '配方编号', recipe.code, payload.code ?? recipe.code],
    ['name', '配方名称', recipe.name, payload.name ?? recipe.name],
    ['categoryId', '目录', `${recipe.category.code} ${recipe.category.name}`, afterCategoryName],
    ['batchQuantity', '批次数量', recipe.batchQuantity, payload.batchQuantity ?? recipe.batchQuantity],
    ['shelfLifeDays', '保质期(天)', recipe.shelfLifeDays, payload.shelfLifeDays ?? recipe.shelfLifeDays],
    ['viscosity', '黏度', recipe.viscosity, payload.viscosity ?? recipe.viscosity],
    ['viscosityUnit', '黏度单位', recipe.viscosityUnit, payload.viscosityUnit ?? recipe.viscosityUnit],
    ['notes', '备注', recipe.notes, payload.notes ?? recipe.notes],
    ['productionSpeedRequirements', '生产转速要求', recipe.productionSpeedRequirements, payload.productionSpeedRequirements ?? recipe.productionSpeedRequirements],
    ['productionTimeRequirements', '生产时间要求', recipe.productionTimeRequirements, payload.productionTimeRequirements ?? recipe.productionTimeRequirements],
    ['packagingRequirements', '包装要求', recipe.packagingRequirements, payload.packagingRequirements ?? recipe.packagingRequirements],
    ['productionNotes', '生产注意事项', recipe.productionNotes, payload.productionNotes ?? recipe.productionNotes],
    ['qcTestItems', 'QC 测试项目', recipe.qcTestItems, payload.qcTestItems ?? recipe.qcTestItems],
    ['qcTestStandard', 'QC 测试标准', recipe.qcTestStandard, payload.qcTestStandard ?? recipe.qcTestStandard],
    ['qcResult', 'QC 结果', recipe.qcResult, payload.qcResult ?? recipe.qcResult],
  ]

  for (const [, label, before, after] of basicFields) {
    if (!valuesDiffer(before, after)) continue
    diff.push({
      section: label === '批次数量' ? '批次' : '基础信息',
      label,
      before: formatReviewValue(before),
      after: formatReviewValue(after),
    })
  }

  const beforeItems = currentReviewItems(recipe)
  const afterItems = payload.items
    ? await payloadReviewItems(recipeId, payload.items)
    : beforeItems
  const beforeItemMap = new Map(beforeItems.map(item => [item.key, item]))
  const afterItemMap = new Map(afterItems.map(item => [item.key, item]))
  let addedCount = 0
  let removedCount = 0
  let changedCount = 0

  for (const item of afterItems) {
    const before = beforeItemMap.get(item.key)
    if (!before) {
      addedCount += 1
      diff.push({ section: '物料', label: `新增 ${item.label}`, before: '—', after: formatItemState(item) })
      continue
    }
    if (valuesDiffer(before.quantity, item.quantity) || valuesDiffer(before.unitPrice, item.unitPrice)) {
      changedCount += 1
      diff.push({
        section: '物料',
        label: item.label,
        before: formatItemState(before),
        after: formatItemState(item),
      })
    }
  }

  for (const item of beforeItems) {
    if (afterItemMap.has(item.key)) continue
    removedCount += 1
    diff.push({ section: '物料', label: `删除 ${item.label}`, before: formatItemState(item), after: '—' })
  }

  if (addedCount || removedCount || changedCount) {
    summary.push(`物料：新增 ${addedCount} 项、删除 ${removedCount} 项、修改 ${changedCount} 项`)
  }

  const beforeUnitCost = recipe.unitCost ?? recipe.totals.unitCost
  const afterUnitCost = payload.items
    ? computeUnitCostFromItems(afterItems.map(item => ({ quantity: item.quantity, unitPrice: item.unitPrice })))
    : beforeUnitCost
  if (valuesDiffer(beforeUnitCost, afterUnitCost)) {
    summary.push(`单位成本：${formatMoneyValue(beforeUnitCost)} → ${formatMoneyValue(afterUnitCost)}`)
    diff.push({
      section: '成本',
      label: '单位成本',
      before: formatMoneyValue(beforeUnitCost),
      after: formatMoneyValue(afterUnitCost),
    })
  }

  if (valuesDiffer(recipe.batchQuantity, payload.batchQuantity ?? recipe.batchQuantity)) {
    summary.push(`批次数量：${formatReviewValue(recipe.batchQuantity)} → ${formatReviewValue(payload.batchQuantity)}`)
  }

  const otherDiffCount = diff.filter(item => !['物料', '成本', '批次'].includes(item.section)).length
  if (otherDiffCount > 0) summary.push(`基础/工艺/QC 字段变更 ${otherDiffCount} 项`)
  if (summary.length === 0) summary.push('未检测到可见字段变化')

  return { changeSummary: summary, changeDiff: diff }
}

async function enrichRecipeChangeRequest(
  row: Prisma.CosTableRecipeChangeRequestGetPayload<{ include: typeof changeRequestInclude }>,
) {
  const serialized = serializeRecipeChangeRequest(row)
  try {
    const review = await buildRecipeChangeReview(
      row.recipeId,
      row.action,
      (row.payload ?? {}) as RecipePatchInput,
    )
    return { ...serialized, ...review }
  } catch (err) {
    return {
      ...serialized,
      changeSummary: [err instanceof Error ? `变更对比生成失败：${err.message}` : '变更对比生成失败'],
      changeDiff: [],
    }
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

  return Promise.all(rows.map(enrichRecipeChangeRequest))
}
