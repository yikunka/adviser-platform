import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type RawMaterialInput = {
  category: string
  attributeCode: string
  productionCode: string
  huaxingCode: string
  name: string
  primarySupplierId: string | null
  primarySupplierCode: string
  primarySupplierName: string
  primarySupplierContactPerson: string
  primarySupplierContactInfo: string
  primarySupplierAddress: string
  primaryPackageKg: number | null
  primaryPricePerKg: number | null
  primaryTaxIncluded: string
  primaryFreightIncluded: string
  primaryNotes: string
  secondarySupplierId: string | null
  secondarySupplierCode: string
  secondarySupplierName: string
  secondarySupplierContactPerson: string
  secondarySupplierContactInfo: string
  secondarySupplierAddress: string
  secondaryPackageKg: number | null
  secondaryPricePerKg: number | null
  secondaryTaxIncluded: string
  secondaryFreightIncluded: string
  secondaryNotes: string
  tdsFileKey?: string | null
  msdsFileKey?: string | null
}

export type RawMaterialRow = RawMaterialInput & {
  id: string
  createdAt: string
  updatedAt: string
}

export type RawMaterialListRow = RawMaterialRow & {
  isUsedInRecipe: boolean
  recipeUsageCount: number
}

const CATEGORY_KEY = '待生产明细：调色部  '
const MEANINGFUL_KEYS = {
  category: CATEGORY_KEY,
  attributeCode: '属性',
  productionCode: '生产号',
  huaxingCode: 'CAS',
  name: '名称',
  primarySupplierCode: '常用供应商',
  primarySupplierName: '供应商名称',
  primaryPackageKg: '包装/KG',
  primaryPricePerKg: '价格/KG',
  primaryTaxIncluded: '含税',
  primaryFreightIncluded: '运费',
  primaryNotes: '备注',
  secondarySupplierCode: '供应商2',
  secondarySupplierName: '供应商名称_1',
  secondaryPackageKg: '包装/KG_1',
  secondaryPricePerKg: '价格/KG_1',
  secondaryTaxIncluded: '含税_1',
  secondaryFreightIncluded: '运费_1',
  secondaryNotes: '备注_1',
} as const

const LEGACY_MEANINGFUL_KEYS = {
  huaxingCode: '华兴号',
} as const

function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function excelValue(row: Record<string, unknown>, key: string, legacyKey?: string): unknown {
  const value = row[key]
  if (value !== undefined && value !== '') return value
  return legacyKey ? row[legacyKey] : value
}

function yn(value: unknown): string {
  const s = str(value).toUpperCase()
  if (s === 'Y' || s === 'N') return s
  return ''
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function parseExcelRow(row: Record<string, unknown>): RawMaterialInput | null {
  const productionCode = str(row[MEANINGFUL_KEYS.productionCode])
  if (!productionCode) return null

  return {
    category: str(row[MEANINGFUL_KEYS.category]),
    attributeCode: str(row[MEANINGFUL_KEYS.attributeCode]),
    productionCode,
    huaxingCode: str(excelValue(row, MEANINGFUL_KEYS.huaxingCode, LEGACY_MEANINGFUL_KEYS.huaxingCode)),
    name: str(row[MEANINGFUL_KEYS.name]),
    primarySupplierId: null,
    primarySupplierCode: str(row[MEANINGFUL_KEYS.primarySupplierCode]),
    primarySupplierName: str(row[MEANINGFUL_KEYS.primarySupplierName]),
    primarySupplierContactPerson: '',
    primarySupplierContactInfo: '',
    primarySupplierAddress: '',
    primaryPackageKg: num(row[MEANINGFUL_KEYS.primaryPackageKg]),
    primaryPricePerKg: num(row[MEANINGFUL_KEYS.primaryPricePerKg]),
    primaryTaxIncluded: yn(row[MEANINGFUL_KEYS.primaryTaxIncluded]),
    primaryFreightIncluded: yn(row[MEANINGFUL_KEYS.primaryFreightIncluded]),
    primaryNotes: str(row[MEANINGFUL_KEYS.primaryNotes]),
    secondarySupplierId: null,
    secondarySupplierCode: str(row[MEANINGFUL_KEYS.secondarySupplierCode]),
    secondarySupplierName: str(row[MEANINGFUL_KEYS.secondarySupplierName]),
    secondarySupplierContactPerson: '',
    secondarySupplierContactInfo: '',
    secondarySupplierAddress: '',
    secondaryPackageKg: num(row[MEANINGFUL_KEYS.secondaryPackageKg]),
    secondaryPricePerKg: num(row[MEANINGFUL_KEYS.secondaryPricePerKg]),
    secondaryTaxIncluded: yn(row[MEANINGFUL_KEYS.secondaryTaxIncluded]),
    secondaryFreightIncluded: yn(row[MEANINGFUL_KEYS.secondaryFreightIncluded]),
    secondaryNotes: str(row[MEANINGFUL_KEYS.secondaryNotes]),
  }
}

export function dedupeByProductionCode(rows: RawMaterialInput[]): RawMaterialInput[] {
  const map = new Map<string, RawMaterialInput>()
  for (const row of rows) {
    map.set(row.productionCode, row)
  }
  return [...map.values()]
}

export function toPrismaCreateData(input: RawMaterialInput): Prisma.CosTableRawMaterialUncheckedCreateInput {
  return {
    category: input.category,
    attributeCode: input.attributeCode,
    productionCode: input.productionCode,
    huaxingCode: input.huaxingCode,
    name: input.name,
    primarySupplierId: input.primarySupplierId,
    primarySupplierCode: input.primarySupplierCode,
    primarySupplierName: input.primarySupplierName,
    primarySupplierContactPerson: input.primarySupplierContactPerson,
    primarySupplierContactInfo: input.primarySupplierContactInfo,
    primarySupplierAddress: input.primarySupplierAddress,
    primaryPackageKg: input.primaryPackageKg,
    primaryPricePerKg: input.primaryPricePerKg,
    primaryTaxIncluded: input.primaryTaxIncluded,
    primaryFreightIncluded: input.primaryFreightIncluded,
    primaryNotes: input.primaryNotes,
    secondarySupplierId: input.secondarySupplierId,
    secondarySupplierCode: input.secondarySupplierCode,
    secondarySupplierName: input.secondarySupplierName,
    secondarySupplierContactPerson: input.secondarySupplierContactPerson,
    secondarySupplierContactInfo: input.secondarySupplierContactInfo,
    secondarySupplierAddress: input.secondarySupplierAddress,
    secondaryPackageKg: input.secondaryPackageKg,
    secondaryPricePerKg: input.secondaryPricePerKg,
    secondaryTaxIncluded: input.secondaryTaxIncluded,
    secondaryFreightIncluded: input.secondaryFreightIncluded,
    secondaryNotes: input.secondaryNotes,
    tdsFileKey: input.tdsFileKey,
    msdsFileKey: input.msdsFileKey,
  }
}

/**
 * Distinct factory-linked recipe count per raw material ID.
 * Only recipes with formula_is_used (directly or via nested components on products) count.
 */
export async function getRecipeUsageCountsByRawMaterialIds(
  rawMaterialIds: string[],
): Promise<Map<string, number>> {
  if (rawMaterialIds.length === 0) return new Map()

  const rows = await prisma.cosTableRecipeItem.findMany({
    where: {
      rawMaterialId: { in: rawMaterialIds },
      recipe: { formulaIsUsed: true },
    },
    select: { rawMaterialId: true, recipeId: true },
  })

  const recipeIdsByMaterial = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.rawMaterialId) continue
    let set = recipeIdsByMaterial.get(row.rawMaterialId)
    if (!set) {
      set = new Set()
      recipeIdsByMaterial.set(row.rawMaterialId, set)
    }
    set.add(row.recipeId)
  }

  const counts = new Map<string, number>()
  for (const id of rawMaterialIds) {
    counts.set(id, recipeIdsByMaterial.get(id)?.size ?? 0)
  }
  return counts
}

export function serializeRawMaterialListRow(
  row: Parameters<typeof serializeRawMaterial>[0],
  recipeUsageCount: number,
): RawMaterialListRow {
  return {
    ...serializeRawMaterial(row),
    isUsedInRecipe: recipeUsageCount > 0,
    recipeUsageCount,
  }
}

export function serializeRawMaterial(row: {
  id: string
  category: string
  attributeCode: string
  productionCode: string
  huaxingCode: string
  name: string
  primarySupplierId: string | null
  primarySupplierCode: string
  primarySupplierName: string
  primarySupplierContactPerson: string
  primarySupplierContactInfo: string
  primarySupplierAddress: string
  primaryPackageKg: unknown
  primaryPricePerKg: unknown
  primaryTaxIncluded: string
  primaryFreightIncluded: string
  primaryNotes: string
  secondarySupplierId: string | null
  secondarySupplierCode: string
  secondarySupplierName: string
  secondarySupplierContactPerson: string
  secondarySupplierContactInfo: string
  secondarySupplierAddress: string
  secondaryPackageKg: unknown
  secondaryPricePerKg: unknown
  secondaryTaxIncluded: string
  secondaryFreightIncluded: string
  secondaryNotes: string
  tdsFileKey: string | null
  msdsFileKey: string | null
  createdAt: Date
  updatedAt: Date
}): RawMaterialRow {
  return {
    id: row.id,
    category: row.category,
    attributeCode: row.attributeCode,
    productionCode: row.productionCode,
    huaxingCode: row.huaxingCode,
    name: row.name,
    primarySupplierId: row.primarySupplierId,
    primarySupplierCode: row.primarySupplierCode,
    primarySupplierName: row.primarySupplierName,
    primarySupplierContactPerson: row.primarySupplierContactPerson,
    primarySupplierContactInfo: row.primarySupplierContactInfo,
    primarySupplierAddress: row.primarySupplierAddress,
    primaryPackageKg: row.primaryPackageKg != null ? Number(row.primaryPackageKg) : null,
    primaryPricePerKg: row.primaryPricePerKg != null ? Number(row.primaryPricePerKg) : null,
    primaryTaxIncluded: row.primaryTaxIncluded,
    primaryFreightIncluded: row.primaryFreightIncluded,
    primaryNotes: row.primaryNotes,
    secondarySupplierId: row.secondarySupplierId,
    secondarySupplierCode: row.secondarySupplierCode,
    secondarySupplierName: row.secondarySupplierName,
    secondarySupplierContactPerson: row.secondarySupplierContactPerson,
    secondarySupplierContactInfo: row.secondarySupplierContactInfo,
    secondarySupplierAddress: row.secondarySupplierAddress,
    secondaryPackageKg: row.secondaryPackageKg != null ? Number(row.secondaryPackageKg) : null,
    secondaryPricePerKg: row.secondaryPricePerKg != null ? Number(row.secondaryPricePerKg) : null,
    secondaryTaxIncluded: row.secondaryTaxIncluded,
    secondaryFreightIncluded: row.secondaryFreightIncluded,
    secondaryNotes: row.secondaryNotes,
    tdsFileKey: row.tdsFileKey,
    msdsFileKey: row.msdsFileKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
