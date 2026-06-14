import type {
  CosProcessKitChangeAction,
  CosProcessKitChangeRequest,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  deriveProcessFlowItemsFromLegacy,
  normalizeProcessFlowItems,
  processFlowItemsForDb,
  remapProcessFlowProductIds,
  type ProcessFlowItem,
} from '@/lib/cosmocoat/process-flow'
import { normalizePerformanceStandards } from '@/lib/cosmocoat/process-kit-standards'
import { getProcessKitById } from '@/lib/cosmocoat/process-kits'
import {
  processKitPatchSchema,
  type ProcessKitPatchInput,
  type ProcessKitProductInput,
  type ProcessKitTestInput,
} from '@/lib/cosmocoat/process-kit-patch-schema'

const changeRequestInclude = {
  kit: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  },
  requestedBy: { select: { id: true, nameEn: true, email: true } },
  reviewedBy: { select: { id: true, nameEn: true, email: true } },
} satisfies Prisma.CosProcessKitChangeRequestInclude

type SerializedKit = NonNullable<Awaited<ReturnType<typeof getProcessKitById>>>

type SerializedProduct = SerializedKit['products'][number]
type SerializedTest = SerializedKit['tests'][number]

export type ProcessKitChangeDiffLine = {
  section: string
  label: string
  before: string
  after: string
}

export type SerializedProcessKitChangeRequest = {
  id: string
  kitId: string
  action: CosProcessKitChangeAction
  payload: unknown
  status: CosProcessKitChangeRequest['status']
  requestNote: string
  reviewNote: string
  requestedById: string
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  kit: {
    id: string
    code: string
    name: string
    status: string
  }
  requestedBy: { id: string; nameEn: string | null; email: string }
  reviewedBy: { id: string; nameEn: string | null; email: string } | null
  changeSummary: string[]
  changeDiff: ProcessKitChangeDiffLine[]
}

type AuditActor = {
  id: string
  name: string | null
}

function formatReviewValue(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
  if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '—'
  return String(value)
}

function valuesDiffer(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

function productClientId(product: ProcessKitProductInput, index: number) {
  return product.clientId?.trim() || product.id?.trim() || `${index}`
}

function productDisplay(product: Pick<ProcessKitProductInput, 'productName' | 'quantityRatio' | 'hardenerProductId' | 'hardenerRatio' | 'thinnerProductId' | 'thinnerRatio' | 'irMinutes' | 'irTemperature' | 'uvEnergy' | 'filmThickness' | 'sprayViscosity' | 'notes'>) {
  const parts = [product.productName ?? '—']
  const detailParts = [
    product.quantityRatio ? `比例 ${product.quantityRatio}` : null,
    product.hardenerProductId ? `HD ${product.hardenerRatio || '—'}` : null,
    product.thinnerProductId ? `Diluent ${product.thinnerRatio || '—'}` : null,
    product.irMinutes ? `IR ${product.irMinutes}` : null,
    product.irTemperature ? `IR温度 ${product.irTemperature}` : null,
    product.uvEnergy ? `UV ${product.uvEnergy}` : null,
    product.filmThickness ? `膜厚 ${product.filmThickness}` : null,
    product.sprayViscosity ? `粘度 ${product.sprayViscosity}` : null,
  ].filter(Boolean)
  if (detailParts.length > 0) parts.push(detailParts.join('；'))
  if (product.notes?.trim()) parts.push(`备注 ${product.notes.trim()}`)
  return parts.join('｜')
}

function currentProductDisplay(product: SerializedProduct) {
  return productDisplay(product)
}

function testDisplay(test: {
  testType: string
  testResult: string
  testDate: string
  testerName: string | null | undefined
  testNotes: string | null | undefined
}) {
  const parts = [
    test.testType,
    test.testResult,
    test.testerName?.trim() || '—',
    new Date(test.testDate).toLocaleDateString('zh-CN'),
  ]
  if (test.testNotes?.trim()) parts.push(test.testNotes.trim())
  return parts.join('｜')
}

function currentTestDisplay(test: SerializedTest) {
  return testDisplay(test)
}

function processFlowLineDisplay(item: ProcessFlowItem, productNameById: Map<string, string>) {
  if (item.type === 'product') {
    return `产品：${productNameById.get(item.kitProductId) ?? item.kitProductId}`
  }
  return `工艺：${item.text}`
}

async function resolveFactoryProductNames(productIds: string[]) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map<string, string>()

  const items = await prisma.cosTableFactoryProduct.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, productCode: true, name: true },
  })
  if (items.length !== uniqueIds.length) {
    throw new ProcessKitChangeRequestError('工厂产品不存在', 400)
  }
  return new Map(items.map(item => [item.id, `${item.productCode} · ${item.name}`]))
}

async function resolveProductRows(products: ProcessKitProductInput[]) {
  const nameById = await resolveFactoryProductNames(products.flatMap(product => [
    product.productId,
    product.hardenerProductId ?? '',
    product.thinnerProductId ?? '',
  ]))

  return products.map((product, index) => ({
    clientId: productClientId(product, index),
    productId: product.productId,
    productName: product.productName?.trim() || nameById.get(product.productId)!,
    sortOrder: product.sortOrder ?? index,
    quantityRatio: product.quantityRatio || null,
    usageMethod: product.usageMethod || '',
    hardenerProductId: product.hardenerProductId || null,
    hardenerProductName: product.hardenerProductId ? nameById.get(product.hardenerProductId)! : null,
    hardenerRatio: product.hardenerProductId ? (product.hardenerRatio || null) : null,
    thinnerProductId: product.thinnerProductId || null,
    thinnerProductName: product.thinnerProductId ? nameById.get(product.thinnerProductId)! : null,
    thinnerRatio: product.thinnerProductId ? (product.thinnerRatio || null) : null,
    irMinutes: product.irMinutes || null,
    irTemperature: product.irTemperature || null,
    uvEnergy: product.uvEnergy || null,
    filmThickness: product.filmThickness || null,
    sprayViscosity: product.sprayViscosity || null,
    notes: product.notes || null,
    processBlocks: product.processBlocks ?? [],
  }))
}

function buildProcessFlowItemsForSave(
  productRows: Awaited<ReturnType<typeof resolveProductRows>>,
  createdProducts: { id: string; sortOrder: number }[],
  requestedItems: ProcessFlowItem[] | undefined,
) {
  const idMap = new Map<string, string>()
  productRows.forEach((row, index) => {
    const created = createdProducts.find(product => product.sortOrder === row.sortOrder) ?? createdProducts[index]
    if (created) idMap.set(row.clientId, created.id)
  })

  const normalizedRequested = normalizeProcessFlowItems(requestedItems ?? [])
  if (normalizedRequested.length > 0) {
    return remapProcessFlowProductIds(normalizedRequested, idMap)
  }

  return deriveProcessFlowItemsFromLegacy(
    productRows.map((row, index) => ({
      id: createdProducts[index]?.id ?? row.clientId,
      productName: row.productName,
      processBlocks: row.processBlocks,
    })),
  )
}

async function resolveTestsForSave(tests: ProcessKitTestInput[]) {
  const testerIds = [...new Set(tests.map(test => test.testerId).filter((id): id is string => Boolean(id)))]
  const testers = testerIds.length > 0
    ? await prisma.cosEmployee.findMany({
        where: {
          id: { in: testerIds },
          employeeType: 'TECHNICAL',
          isActive: true,
        },
        select: { id: true, name: true },
      })
    : []
  const testerMap = new Map(testers.map(tester => [tester.id, tester.name]))

  if (testers.length !== testerIds.length) {
    throw new ProcessKitChangeRequestError('请选择有效的技术人员', 400)
  }

  return tests.map(test => {
    const testerName = test.testerId
      ? (testerMap.get(test.testerId) ?? test.testerName.trim())
      : test.testerName.trim()
    if (!testerName) {
      throw new ProcessKitChangeRequestError('测试记录缺少测试人员', 400)
    }

    return {
      testType: test.testType,
      testResult: test.testResult ?? 'PENDING',
      testDate: new Date(test.testDate),
      testerId: test.testerId || null,
      testerName,
      reportLink: test.reportLink?.trim() || null,
      testNotes: test.testNotes?.trim() || null,
      passedAt: test.passedAt
        ? new Date(test.passedAt)
        : ((test.testResult ?? 'PENDING') === 'PASSED' ? new Date(test.testDate) : null),
    }
  })
}

export class ProcessKitChangeRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ProcessKitChangeRequestError'
  }
}

export function serializeProcessKitChangeRequest(
  row: Prisma.CosProcessKitChangeRequestGetPayload<{ include: typeof changeRequestInclude }>,
): SerializedProcessKitChangeRequest {
  return {
    id: row.id,
    kitId: row.kitId,
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
    kit: row.kit,
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    changeSummary: [],
    changeDiff: [],
  }
}

export async function findPendingProcessKitChangeRequest(kitId: string) {
  return prisma.cosProcessKitChangeRequest.findFirst({
    where: { kitId, status: 'PENDING' },
    include: changeRequestInclude,
  })
}

export async function validateProcessKitPatch(kitId: string, data: ProcessKitPatchInput, current: { code: string }) {
  if (data.code && data.code !== current.code) {
    const duplicate = await prisma.cosProcessKit.findUnique({ where: { code: data.code } })
    if (duplicate) throw new ProcessKitChangeRequestError('工艺书编号已存在', 409)
  }

  if (data.products) {
    await resolveProductRows(data.products)
  }

  if (data.processFlowItems) {
    const productIds = new Set((data.products ?? []).map((product, index) => productClientId(product, index)))
    if (data.products && productIds.size > 0) {
      for (const item of data.processFlowItems) {
        if (item.type === 'product' && !productIds.has(item.kitProductId)) {
          throw new ProcessKitChangeRequestError('工艺流程中包含不存在的产品明细', 400)
        }
      }
    }
  }

  if (data.tests) {
    await resolveTestsForSave(data.tests)
  }

  processKitPatchSchema.parse(data)
  void kitId
}

export async function rejectPendingProcessKitChangeRequests(kitId: string, reviewerId: string, reviewNote: string) {
  await prisma.cosProcessKitChangeRequest.updateMany({
    where: { kitId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote,
    },
  })
}

export async function applyProcessKitUpdate(
  kitId: string,
  data: ProcessKitPatchInput,
  actor: AuditActor,
) {
  const current = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!current) throw new ProcessKitChangeRequestError('工艺书不存在', 404)

  await validateProcessKitPatch(kitId, data, current)

  const normalizedStandards = data.performanceStandards !== undefined
    ? normalizePerformanceStandards(data.performanceStandards)
    : undefined
  const productRows = data.products ? await resolveProductRows(data.products) : null
  const tests = data.tests ? await resolveTestsForSave(data.tests) : null
  const requestedFlowItems = data.processFlowItems ? normalizeProcessFlowItems(data.processFlowItems) : undefined

  await prisma.$transaction(async tx => {
    await tx.cosProcessKit.update({
      where: { id: kitId },
      data: {
        code: data.code,
        name: data.name,
        description: data.description !== undefined ? (data.description || null) : undefined,
        materials: data.materials,
        performanceStandards: normalizedStandards,
        otherNote: data.otherNote !== undefined ? (data.otherNote || null) : undefined,
        processDescription: data.processDescription !== undefined ? (data.processDescription || null) : undefined,
        processFlowNote: data.processFlowNote !== undefined ? (data.processFlowNote || null) : undefined,
        status: data.status,
        updatedBy: actor.id,
        updatedByName: actor.name,
      },
    })

    if (productRows) {
      await tx.cosProcessKitProduct.deleteMany({ where: { kitId } })
      const createdProducts: { id: string; sortOrder: number }[] = []
      for (const row of productRows) {
        const created = await tx.cosProcessKitProduct.create({
          data: {
            kitId,
            productId: row.productId,
            productName: row.productName,
            sortOrder: row.sortOrder,
            quantityRatio: row.quantityRatio,
            usageMethod: row.usageMethod,
            hardenerProductId: row.hardenerProductId,
            hardenerProductName: row.hardenerProductName,
            hardenerRatio: row.hardenerRatio,
            thinnerProductId: row.thinnerProductId,
            thinnerProductName: row.thinnerProductName,
            thinnerRatio: row.thinnerRatio,
            irMinutes: row.irMinutes,
            irTemperature: row.irTemperature,
            uvEnergy: row.uvEnergy,
            filmThickness: row.filmThickness,
            sprayViscosity: row.sprayViscosity,
            notes: row.notes,
            processBlocks: row.processBlocks,
          },
          select: { id: true, sortOrder: true },
        })
        createdProducts.push(created)
      }

      const nextItems = buildProcessFlowItemsForSave(productRows, createdProducts, requestedFlowItems)
      await tx.cosProcessKit.update({
        where: { id: kitId },
        data: { processFlowItems: processFlowItemsForDb(nextItems) },
      })
    } else if (requestedFlowItems) {
      const existingProducts = await tx.cosProcessKitProduct.findMany({
        where: { kitId },
        select: { id: true },
      })
      const validProductIds = new Set(existingProducts.map(product => product.id))
      for (const item of requestedFlowItems) {
        if (item.type === 'product' && !validProductIds.has(item.kitProductId)) {
          throw new ProcessKitChangeRequestError('工艺流程中包含不存在的产品明细', 400)
        }
      }
      await tx.cosProcessKit.update({
        where: { id: kitId },
        data: { processFlowItems: processFlowItemsForDb(requestedFlowItems) },
      })
    }

    if (tests) {
      await tx.cosProcessTest.deleteMany({ where: { kitId } })
      for (const test of tests) {
        await tx.cosProcessTest.create({
          data: {
            kitId,
            ...test,
          },
        })
      }
    }
  })

  return getProcessKitById(kitId)
}

export async function applyProcessKitDelete(kitId: string) {
  const current = await prisma.cosProcessKit.findUnique({ where: { id: kitId } })
  if (!current) throw new ProcessKitChangeRequestError('工艺书不存在', 404)
  await prisma.cosProcessKit.delete({ where: { id: kitId } })
}

async function buildProcessKitChangeReview(
  kitId: string,
  action: CosProcessKitChangeAction,
  payload: ProcessKitPatchInput,
) {
  const kit = await getProcessKitById(kitId)
  if (!kit) {
    return {
      changeSummary: ['当前工艺书已不存在，无法生成变更对比'],
      changeDiff: [] as ProcessKitChangeDiffLine[],
    }
  }

  if (action === 'DELETE') {
    return {
      changeSummary: [
        `删除工艺书 ${kit.code} · ${kit.name}`,
        `当前包含 ${kit.products.length} 个参考产品、${kit.tests.length} 条测试记录`,
      ],
      changeDiff: [{
        section: '删除',
        label: '工艺书记录',
        before: `${kit.code} · ${kit.name}`,
        after: '删除',
      }],
    }
  }

  const summary: string[] = []
  const diff: ProcessKitChangeDiffLine[] = []
  const pushDiff = (section: string, label: string, before: unknown, after: unknown) => {
    if (!valuesDiffer(before, after)) return
    diff.push({
      section,
      label,
      before: formatReviewValue(before),
      after: formatReviewValue(after),
    })
  }

  pushDiff('基本信息', '名称', kit.name, payload.name ?? kit.name)
  pushDiff('基本信息', '状态', kit.status, payload.status ?? kit.status)
  pushDiff('基本信息', '描述', kit.description ?? '', payload.description ?? kit.description ?? '')
  pushDiff('基本信息', '适用材料', kit.materials, payload.materials ?? kit.materials)
  pushDiff('基本信息', '性能测试', kit.performanceStandards, payload.performanceStandards ?? kit.performanceStandards)
  pushDiff('基本信息', '其他材料说明', kit.otherNote ?? '', payload.otherNote ?? kit.otherNote ?? '')
  pushDiff('工艺说明', '工艺补充说明', kit.processDescription ?? '', payload.processDescription ?? kit.processDescription ?? '')
  pushDiff('工艺说明', '全局备注', kit.processFlowNote ?? '', payload.processFlowNote ?? kit.processFlowNote ?? '')

  if (payload.products) {
    const currentProducts = kit.products.map(currentProductDisplay)
    const nextRows = await resolveProductRows(payload.products)
    const nextProducts = nextRows.map(productDisplay)
    const max = Math.max(currentProducts.length, nextProducts.length)
    for (let index = 0; index < max; index += 1) {
      pushDiff('产品组合', `产品 ${index + 1}`, currentProducts[index] ?? '—', nextProducts[index] ?? '—')
    }
    summary.push(`产品组合 ${currentProducts.length} → ${nextProducts.length}`)
  }

  if (payload.processFlowItems) {
    const currentProductNameById = new Map(kit.products.map(product => [product.id, product.productName]))
    const nextRows = payload.products ? await resolveProductRows(payload.products) : null
    const nextProductNameById = nextRows
      ? new Map(nextRows.map(row => [row.clientId, row.productName]))
      : currentProductNameById
    const currentItems = kit.processFlowItems.map(item => processFlowLineDisplay(item, currentProductNameById))
    const nextItems = normalizeProcessFlowItems(payload.processFlowItems).map(item => processFlowLineDisplay(item, nextProductNameById))
    const max = Math.max(currentItems.length, nextItems.length)
    for (let index = 0; index < max; index += 1) {
      pushDiff('工艺流程', `步骤 ${index + 1}`, currentItems[index] ?? '—', nextItems[index] ?? '—')
    }
    summary.push(`工艺流程 ${currentItems.length} → ${nextItems.length}`)
  }

  if (payload.tests) {
    const currentTests = kit.tests.map(currentTestDisplay)
    const nextTests = payload.tests.map(testDisplay)
    const max = Math.max(currentTests.length, nextTests.length)
    for (let index = 0; index < max; index += 1) {
      pushDiff('测试记录', `测试 ${index + 1}`, currentTests[index] ?? '—', nextTests[index] ?? '—')
    }
    summary.push(`测试记录 ${currentTests.length} → ${nextTests.length}`)
  }

  if (diff.length > 0) {
    summary.unshift(`核心变更 ${diff.length} 项`)
  } else {
    summary.push('未检测到可识别的差异')
  }

  return { changeSummary: summary, changeDiff: diff }
}

async function enrichProcessKitChangeRequest(
  row: Prisma.CosProcessKitChangeRequestGetPayload<{ include: typeof changeRequestInclude }>,
) {
  const serialized = serializeProcessKitChangeRequest(row)
  try {
    const parsed = processKitPatchSchema.partial().parse((row.payload ?? {}) as ProcessKitPatchInput)
    const review = await buildProcessKitChangeReview(row.kitId, row.action, parsed)
    return { ...serialized, ...review }
  } catch (err) {
    return {
      ...serialized,
      changeSummary: [err instanceof Error ? `变更对比生成失败：${err.message}` : '变更对比生成失败'],
      changeDiff: [],
    }
  }
}

export async function createProcessKitChangeRequest(input: {
  kitId: string
  action: CosProcessKitChangeAction
  payload?: ProcessKitPatchInput | null
  requestedById: string
  requestNote?: string
}) {
  const pending = await findPendingProcessKitChangeRequest(input.kitId)
  if (pending) {
    throw new ProcessKitChangeRequestError('该工艺书已有待审批的变更请求，请等待超级管理员处理后再提交', 409)
  }

  const row = await prisma.cosProcessKitChangeRequest.create({
    data: {
      kitId: input.kitId,
      action: input.action,
      payload: input.payload != null ? (input.payload as Prisma.InputJsonValue) : undefined,
      requestedById: input.requestedById,
      requestNote: input.requestNote?.trim() ?? '',
    },
    include: changeRequestInclude,
  })

  await logAudit(
    input.requestedById,
    'PROCESS_KIT_CHANGE_REQUEST_CREATE',
    'CosProcessKitChangeRequest',
    row.id,
    undefined,
    { kitId: input.kitId, action: input.action },
  )

  return enrichProcessKitChangeRequest(row)
}

export async function reviewProcessKitChangeRequest(input: {
  requestId: string
  reviewerId: string
  action: 'APPROVE' | 'REJECT'
  reviewNote?: string
}) {
  const row = await prisma.cosProcessKitChangeRequest.findUnique({
    where: { id: input.requestId },
    include: changeRequestInclude,
  })
  if (!row) throw new ProcessKitChangeRequestError('审批请求不存在', 404)
  if (row.status !== 'PENDING') {
    throw new ProcessKitChangeRequestError('该审批请求已处理', 409)
  }

  if (input.action === 'REJECT') {
    const updated = await prisma.cosProcessKitChangeRequest.update({
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
      'PROCESS_KIT_CHANGE_REQUEST_REJECT',
      'CosProcessKitChangeRequest',
      row.id,
      row,
      updated,
    )

    return serializeProcessKitChangeRequest(updated)
  }

  const payload = processKitPatchSchema.partial().parse((row.payload ?? {}) as ProcessKitPatchInput)
  const reviewer = await prisma.user.findUnique({
    where: { id: input.reviewerId },
    select: { nameEn: true, email: true },
  })
  if (row.action === 'DELETE') {
    await applyProcessKitDelete(row.kitId)
  } else {
    await applyProcessKitUpdate(row.kitId, payload, {
      id: input.reviewerId,
      name: reviewer?.nameEn ?? reviewer?.email ?? null,
    })
  }

  const updated = await prisma.cosProcessKitChangeRequest.update({
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
    'PROCESS_KIT_CHANGE_REQUEST_APPROVE',
    'CosProcessKitChangeRequest',
    row.id,
    row,
    updated,
  )

  return serializeProcessKitChangeRequest(updated)
}

export async function listProcessKitChangeRequests(opts?: {
  status?: CosProcessKitChangeRequest['status']
  kitId?: string
  limit?: number
}) {
  const status = opts?.status ?? 'PENDING'
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 50))

  const rows = await prisma.cosProcessKitChangeRequest.findMany({
    where: {
      status,
      ...(opts?.kitId ? { kitId: opts.kitId } : {}),
    },
    include: changeRequestInclude,
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  })

  return Promise.all(rows.map(enrichProcessKitChangeRequest))
}
