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

export type ProjectInvoicingStatus = 'NOT_INVOICED' | 'PARTIAL' | 'INVOICED'
export type ProjectCollectionStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

export const PROJECT_INVOICING_LABELS: Record<ProjectInvoicingStatus, string> = {
  NOT_INVOICED: '未开票',
  PARTIAL: '部分开票',
  INVOICED: '已开票',
}

export const PROJECT_COLLECTION_LABELS: Record<ProjectCollectionStatus, string> = {
  UNPAID: '未收款',
  PARTIAL: '部分收款',
  PAID: '已收款',
}

/** Roll up linked invoice statuses for the project list. Cancelled invoices are ignored. */
export function summarizeProjectBilling(statuses: string[]): {
  invoicingStatus: ProjectInvoicingStatus
  collectionStatus: ProjectCollectionStatus
} {
  const active = statuses.filter(status => status !== 'CANCELLED')
  const drafts = active.filter(status => status === 'DRAFT').length
  const issued = active.filter(status => status === 'SENT' || status === 'PAID')
  const paid = issued.filter(status => status === 'PAID').length

  let invoicingStatus: ProjectInvoicingStatus = 'NOT_INVOICED'
  if (issued.length > 0 && drafts === 0) invoicingStatus = 'INVOICED'
  else if (issued.length > 0) invoicingStatus = 'PARTIAL'

  let collectionStatus: ProjectCollectionStatus = 'UNPAID'
  if (issued.length > 0 && paid === issued.length) collectionStatus = 'PAID'
  else if (paid > 0) collectionStatus = 'PARTIAL'

  return { invoicingStatus, collectionStatus }
}
