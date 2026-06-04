import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { buildProcessFlowDocument } from '@/lib/cosmocoat/process-flow'

export const kitInclude = {
  products: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  tests: {
    orderBy: [{ testDate: 'desc' }, { id: 'desc' }],
  },
  createdByUser: {
    select: { id: true, nameEn: true, email: true },
  },
} satisfies Prisma.CosProcessKitInclude

export type ProcessKitWithRelations = Prisma.CosProcessKitGetPayload<{
  include: typeof kitInclude
}>

export function serializeProcessKit(kit: ProcessKitWithRelations) {
  return {
    id: kit.id,
    code: kit.code,
    name: kit.name,
    description: kit.description,
    materials: kit.materials || [],
    performanceStandards: kit.performanceStandards || [],
    otherNote: kit.otherNote,
    processFlowNote: kit.processFlowNote,
    status: kit.status,
    createdBy: kit.createdBy,
    createdByName: kit.createdByName,
    updatedBy: kit.updatedBy,
    updatedByName: kit.updatedByName,
    createdAt: kit.createdAt.toISOString(),
    updatedAt: kit.updatedAt.toISOString(),
    productCount: kit.products.length,
    testCount: kit.tests.length,
    processFlowDocument: buildProcessFlowDocument(kit.products.map(p => ({
      productName: p.productName,
      quantityRatio: p.quantityRatio,
      usageMethod: p.usageMethod,
      hardenerProductName: p.hardenerProductName,
      hardenerRatio: p.hardenerRatio,
      thinnerProductName: p.thinnerProductName,
      thinnerRatio: p.thinnerRatio,
      notes: p.notes,
      irMinutes: p.irMinutes,
      irTemperature: p.irTemperature,
      uvEnergy: p.uvEnergy,
      filmThickness: p.filmThickness,
    })), kit.processFlowNote),
    products: kit.products.map(p => ({
      id: p.id,
      kitId: p.kitId,
      productId: p.productId,
      productName: p.productName,
      sortOrder: p.sortOrder,
      quantityRatio: p.quantityRatio,
      usageMethod: p.usageMethod,
      hardenerProductId: p.hardenerProductId,
      hardenerProductName: p.hardenerProductName,
      hardenerRatio: p.hardenerRatio,
      thinnerProductId: p.thinnerProductId,
      thinnerProductName: p.thinnerProductName,
      thinnerRatio: p.thinnerRatio,
      irMinutes: p.irMinutes,
      irTemperature: p.irTemperature,
      uvEnergy: p.uvEnergy,
      filmThickness: p.filmThickness,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    tests: kit.tests.map(t => ({
      id: t.id,
      kitId: t.kitId,
      testType: t.testType,
      testResult: t.testResult,
      testDate: t.testDate.toISOString(),
      testerName: t.testerName,
      testerId: t.testerId,
      reportLink: t.reportLink,
      testNotes: t.testNotes,
      passedAt: t.passedAt?.toISOString() ?? null,
    })),
    createdByUser: kit.createdByUser
      ? { id: kit.createdByUser.id, name: kit.createdByUser.nameEn, email: kit.createdByUser.email }
      : null,
  }
}

export async function getProcessKitById(id: string) {
  const kit = await prisma.cosProcessKit.findUnique({
    where: { id },
    include: kitInclude,
  })
  if (!kit) return null
  return serializeProcessKit(kit)
}

export async function generateProcessKitCode(): Promise<string> {
  // 获取最新的一个工艺书编号
  const latestKit = await prisma.cosProcessKit.findFirst({
    where: { code: { startsWith: 'GY' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  if (!latestKit?.code) {
    // 没有任何工艺书，从 GY0001 开始
    return 'GY0001'
  }

  // 尝试匹配新格式：GY + 正好 4 位或更多纯数字（与旧格式 GYYYYYMMDDnnn 区分）
  // 新格式：GY0001, GY1234, GY9999
  // 旧格式：GY20251231050 (超过 8 位数字)
  const matchNew = latestKit.code.match(/^GY(\d{4,})$/)
  if (matchNew && matchNew[1].length <= 8) {
    // 新格式且数字位数合理（4-8 位），递增
    const lastNumber = parseInt(matchNew[1], 10)
    return `GY${String(lastNumber === 0 ? 1 : lastNumber + 1).padStart(4, '0')}`
  }

  // 旧格式（如 GY20251231050，包含日期）或无效格式，从 GY0001 重新开始
  return 'GY0001'
}
