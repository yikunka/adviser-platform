import { describe, expect, it } from 'vitest'
import {
  buildCompanyFileManagementSections,
  type CompanyFileManagementRecordInput,
} from './file-management'

describe('company file management sections', () => {
  it('keeps the required display order and enablement flags', () => {
    const sections = buildCompanyFileManagementSections(
      {
        hasCompanyBox: true,
        hasCompanySquareSeal: false,
        hasCompanyRoundSeal: true,
      },
      [],
    )

    expect(sections.map(section => section.key)).toEqual([
      'hasCompanyBox',
      'hasCompanySquareSeal',
      'hasCompanyRoundSeal',
    ])
    expect(sections.map(section => section.labelZh)).toEqual([
      '公司盒',
      '公司方印',
      '公司圆印',
    ])
    expect(sections.map(section => section.enabled)).toEqual([true, false, true])
  })

  it('groups records by asset and sorts them by newest movement date first', () => {
    const records: CompanyFileManagementRecordInput[] = [
      {
        id: 'r1',
        assetType: 'COMPANY_BOX',
        movementType: 'OUT',
        movementDate: '2026-06-01T00:00:00.000Z',
        handler: 'Alice',
        notes: null,
        createdAt: '2026-06-01T09:00:00.000Z',
      },
      {
        id: 'r2',
        assetType: 'COMPANY_BOX',
        movementType: 'IN',
        movementDate: '2026-06-08T00:00:00.000Z',
        handler: 'Bob',
        notes: 'returned',
        createdAt: '2026-06-08T09:00:00.000Z',
      },
      {
        id: 'r3',
        assetType: 'COMPANY_ROUND_SEAL',
        movementType: 'OUT',
        movementDate: '2026-06-03T00:00:00.000Z',
        handler: 'Carol',
        notes: null,
        createdAt: '2026-06-03T09:00:00.000Z',
      },
    ]

    const sections = buildCompanyFileManagementSections(
      {
        hasCompanyBox: true,
        hasCompanySquareSeal: false,
        hasCompanyRoundSeal: true,
      },
      records,
    )

    expect(sections[0]?.records.map(record => record.id)).toEqual(['r2', 'r1'])
    expect(sections[1]?.records).toEqual([])
    expect(sections[2]?.records.map(record => record.id)).toEqual(['r3'])
  })
})
