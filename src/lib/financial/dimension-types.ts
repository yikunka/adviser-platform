/** 维度类型：成本中心 / 项目（结构相同，共用一套 CRUD） */
export type DimensionType = 'cost-center' | 'project'

export const DIMENSION_LABELS: Record<DimensionType, string> = {
  'cost-center': '成本中心',
  project: '项目',
}

export function isDimensionType(value: string | null | undefined): value is DimensionType {
  return value === 'cost-center' || value === 'project'
}
