import type { BulkCompanyImportInput } from '@/lib/entity-groups/schemas'

export type BulkImportPreviewRow = {
  rowIndex: number
  nameEn: string
  resolvedGroupId: string | null
  resolvedGroupName: string | null
  error?: string
}

export type BulkImportPreview = {
  rows: BulkImportPreviewRow[]
  validCount: number
  errorCount: number
}

type GroupLookup = {
  byId: Map<string, { id: string; name: string }>
  byName: Map<string, { id: string; name: string }>
}

export function buildGroupLookup(groups: { id: string; name: string }[]): GroupLookup {
  const byId = new Map<string, { id: string; name: string }>()
  const byName = new Map<string, { id: string; name: string }>()
  for (const g of groups) {
    byId.set(g.id, g)
    byName.set(g.name.trim().toLowerCase(), g)
  }
  return { byId, byName }
}

export function previewBulkCompanyImport(
  input: BulkCompanyImportInput,
  lookup: GroupLookup,
  accessibleGroupIds: string[] | null,
): BulkImportPreview {
  const defaultGroupId = input.groupId ?? null
  const defaultGroupName = input.defaultGroupName?.trim().toLowerCase() ?? null

  const rows: BulkImportPreviewRow[] = input.rows.map((row, index) => {
    let resolvedGroupId: string | null = row.groupId ?? defaultGroupId
    let resolvedGroupName: string | null = null

    if (!resolvedGroupId && row.groupName?.trim()) {
      const hit = lookup.byName.get(row.groupName.trim().toLowerCase())
      if (hit) {
        resolvedGroupId = hit.id
        resolvedGroupName = hit.name
      } else if (input.createGroupIfMissing && defaultGroupName) {
        resolvedGroupName = row.groupName.trim()
      } else {
        return {
          rowIndex: index + 1,
          nameEn: row.nameEn,
          resolvedGroupId: null,
          resolvedGroupName: row.groupName.trim(),
          error: 'Unknown group name',
        }
      }
    }

    if (resolvedGroupId) {
      const g = lookup.byId.get(resolvedGroupId)
      if (!g) {
        return {
          rowIndex: index + 1,
          nameEn: row.nameEn,
          resolvedGroupId,
          resolvedGroupName: null,
          error: 'Group not found',
        }
      }
      resolvedGroupName = g.name
      if (accessibleGroupIds && !accessibleGroupIds.includes(resolvedGroupId)) {
        return {
          rowIndex: index + 1,
          nameEn: row.nameEn,
          resolvedGroupId,
          resolvedGroupName,
          error: 'No access to target group',
        }
      }
    } else if (defaultGroupName) {
      const hit = lookup.byName.get(defaultGroupName)
      if (hit) {
        resolvedGroupId = hit.id
        resolvedGroupName = hit.name
      }
    }

    if (!resolvedGroupId && !input.createGroupIfMissing) {
      return {
        rowIndex: index + 1,
        nameEn: row.nameEn,
        resolvedGroupId: null,
        resolvedGroupName: null,
        error: 'Group is required',
      }
    }

    return {
      rowIndex: index + 1,
      nameEn: row.nameEn,
      resolvedGroupId,
      resolvedGroupName,
    }
  })

  return {
    rows,
    validCount: rows.filter(r => !r.error).length,
    errorCount: rows.filter(r => r.error).length,
  }
}
