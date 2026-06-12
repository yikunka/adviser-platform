import { prisma } from '@/lib/db/prisma'

export type { DimensionType } from '@/lib/financial/dimension-types'
export { DIMENSION_LABELS, isDimensionType } from '@/lib/financial/dimension-types'
import type { DimensionType } from '@/lib/financial/dimension-types'

type DimensionDelegate = {
  findMany(args: unknown): Promise<Array<{ id: string; code: string; name: string; isActive: boolean; createdAt: Date }>>
  create(args: unknown): Promise<{ id: string; code: string; name: string; isActive: boolean; createdAt: Date }>
  update(args: unknown): Promise<{ id: string; code: string; name: string; isActive: boolean; createdAt: Date }>
  delete(args: unknown): Promise<unknown>
  findUnique(args: unknown): Promise<{ id: string; companyId: string } | null>
}

/** 返回对应维度的 Prisma delegate（成本中心 / 项目） */
export function dimensionDelegate(type: DimensionType): DimensionDelegate {
  return (type === 'cost-center' ? prisma.costCenter : prisma.finProject) as unknown as DimensionDelegate
}

/** 该维度记录是否已被凭证行引用（决定删除 vs 停用） */
export async function dimensionInUse(type: DimensionType, id: string): Promise<boolean> {
  const count =
    type === 'cost-center'
      ? await prisma.journalLine.count({ where: { costCenterId: id } })
      : await prisma.journalLine.count({ where: { projectId: id } })
  return count > 0
}

export type SerializedDimension = {
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: string
}

export function serializeDimension(row: {
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: Date
}): SerializedDimension {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}
