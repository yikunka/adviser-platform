import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  groupIdsFromAccess,
  resolveEntityGroupAccess,
} from '@/lib/entity-groups/access'
import { buildGroupLookup, previewBulkCompanyImport } from '@/lib/entity-groups/import'
import { bulkCompanyImportSchema } from '@/lib/entity-groups/schemas'

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'entities' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = bulkCompanyImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid import', details: parsed.error.flatten() }, { status: 400 })
  }

  const previewOnly = req.nextUrl.searchParams.get('preview') === '1'
  const access = await resolveEntityGroupAccess(session!.user.id, session!.user.role)
  const accessibleIds = groupIdsFromAccess(access)

  const groups = await prisma.clientEntityGroup.findMany({
    where: accessibleIds ? { id: { in: accessibleIds } } : undefined,
    select: { id: true, name: true },
  })
  const lookup = buildGroupLookup(groups)
  const preview = previewBulkCompanyImport(parsed.data, lookup, accessibleIds)

  if (previewOnly) {
    return NextResponse.json({ preview })
  }

  if (preview.errorCount > 0) {
    return NextResponse.json({ error: 'Import has validation errors', preview }, { status: 400 })
  }

  const created: { id: string; nameEn: string; groupId: string | null }[] = []

  await prisma.$transaction(async tx => {
    const groupNameToId = new Map(lookup.byName)

    for (const row of preview.rows) {
      let groupId = row.resolvedGroupId

      if (!groupId && parsed.data.createGroupIfMissing && row.resolvedGroupName) {
        const key = row.resolvedGroupName.toLowerCase()
        const existing = groupNameToId.get(key)
        if (existing) {
          groupId = existing.id
        } else {
          const g = await tx.clientEntityGroup.create({
            data: { name: row.resolvedGroupName },
          })
          groupNameToId.set(key, { id: g.id, name: g.name })
          groupId = g.id
        }
      }

      const source = parsed.data.rows[row.rowIndex - 1]
      const company = await tx.company.create({
        data: {
          nameEn: source.nameEn,
          nameZh: source.nameZh ?? null,
          companyNumber: source.companyNumber ?? null,
          companyType: source.companyType ?? null,
          groupId,
        },
      })
      created.push({ id: company.id, nameEn: company.nameEn, groupId })
    }
  })

  await logAudit(session!.user.id, 'CREATE', 'BulkCompanyImport', created[0]?.id ?? 'bulk', null, {
    count: created.length,
  })

  return NextResponse.json({ created, count: created.length })
}
