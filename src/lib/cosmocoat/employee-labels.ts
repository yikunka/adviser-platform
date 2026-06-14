import type { CosEmployeeFileType, CosEmployeeType } from '@prisma/client'

export const COS_EMPLOYEE_TYPE_LABELS: Record<CosEmployeeType, string> = {
  INTERNAL: '内务人员',
  SALES: '销售人员',
  PRODUCTION: '生产人员',
  TECHNICAL: '技术人员',
  OUTSOURCED: '编外人员',
}

export const COS_EMPLOYEE_FILE_TYPE_LABELS: Record<CosEmployeeFileType, string> = {
  LABOR_CONTRACT: '劳动合同',
  RESUME: '简历',
  ID_CARD: '身份证',
}
