import { describe, expect, it } from 'vitest'
import { buildGroupLookup, previewBulkCompanyImport } from '@/lib/entity-groups/import'

describe('bulk company import preview', () => {
  const lookup = buildGroupLookup([
    { id: 'g1', name: 'Acme Holdings' },
    { id: 'g2', name: 'Beta Group' },
  ])

  it('resolves group by name', () => {
    const preview = previewBulkCompanyImport(
      {
        rows: [{ nameEn: 'Acme HK Ltd', groupName: 'Acme Holdings' }],
        createGroupIfMissing: false,
      },
      lookup,
      null,
    )
    expect(preview.validCount).toBe(1)
    expect(preview.rows[0].resolvedGroupId).toBe('g1')
  })

  it('flags unknown group when createGroupIfMissing is false', () => {
    const preview = previewBulkCompanyImport(
      {
        rows: [{ nameEn: 'Unknown Co', groupName: 'Missing Group' }],
        createGroupIfMissing: false,
      },
      lookup,
      null,
    )
    expect(preview.errorCount).toBe(1)
    expect(preview.rows[0].error).toBe('Unknown group name')
  })

  it('enforces accessible group ids for staff', () => {
    const preview = previewBulkCompanyImport(
      {
        groupId: 'g2',
        rows: [{ nameEn: 'Beta OpCo' }],
        createGroupIfMissing: false,
      },
      lookup,
      ['g1'],
    )
    expect(preview.errorCount).toBe(1)
    expect(preview.rows[0].error).toBe('No access to target group')
  })
})
