import type { AdvProjectStatus, AdvProjectType } from '@prisma/client'

export const PROJECT_TYPES: AdvProjectType[] = [
  'COMPANY_INCORPORATION',
  'CORPORATE_SECRETARIAL',
  'ACCOUNTING',
  'OTHER',
]

export const PROJECT_TYPE_LABELS: Record<AdvProjectType, string> = {
  COMPANY_INCORPORATION: '开公司',
  CORPORATE_SECRETARIAL: '企业管理',
  ACCOUNTING: '会计管理',
  OTHER: '其他',
}

export const PROJECT_STATUS_LABELS: Record<AdvProjectStatus, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  EXPIRED: '已到期',
  CANCELLED: '已取消',
  RENEWED: '已续期',
}

export const TASK_STATUS_LABELS = {
  OPEN: '待办',
  DONE: '已完成',
  CANCELLED: '已取消',
} as const

export const INVOICE_PAYMENT_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  SENT: '未收款',
  PAID: '已收款',
  CANCELLED: '已取消',
}
