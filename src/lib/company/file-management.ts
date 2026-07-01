export type CompanyFileManagementAssetType =
  | 'COMPANY_BOX'
  | 'COMPANY_SQUARE_SEAL'
  | 'COMPANY_ROUND_SEAL'

export type CompanyFileManagementMovementType = 'IN' | 'OUT'

export type CompanyFileManagementFlags = {
  hasCompanyBox: boolean
  hasCompanySquareSeal: boolean
  hasCompanyRoundSeal: boolean
}

export type CompanyFileManagementSectionKey = keyof CompanyFileManagementFlags

export type CompanyFileManagementRecordInput = {
  id: string
  assetType: CompanyFileManagementAssetType
  movementType: CompanyFileManagementMovementType
  movementDate: string
  handler: string
  notes: string | null
  createdAt: string
}

type CompanyFileManagementSectionDefinition = {
  key: CompanyFileManagementSectionKey
  assetType: CompanyFileManagementAssetType
  labelZh: string
}

const COMPANY_FILE_MANAGEMENT_SECTIONS: CompanyFileManagementSectionDefinition[] = [
  { key: 'hasCompanyBox', assetType: 'COMPANY_BOX', labelZh: '公司盒' },
  { key: 'hasCompanySquareSeal', assetType: 'COMPANY_SQUARE_SEAL', labelZh: '公司方印' },
  { key: 'hasCompanyRoundSeal', assetType: 'COMPANY_ROUND_SEAL', labelZh: '公司圆印' },
]

export function buildCompanyFileManagementSections(
  flags: CompanyFileManagementFlags,
  records: CompanyFileManagementRecordInput[],
) {
  return COMPANY_FILE_MANAGEMENT_SECTIONS.map(section => ({
    ...section,
    enabled: flags[section.key],
    records: records
      .filter(record => record.assetType === section.assetType)
      .sort((left, right) => {
        const byMovementDate = new Date(right.movementDate).getTime() - new Date(left.movementDate).getTime()
        if (byMovementDate !== 0) return byMovementDate
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      }),
  }))
}
