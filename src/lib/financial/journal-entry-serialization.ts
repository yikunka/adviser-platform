import { prisma } from '@/lib/db/prisma'
import { buildAccountByIdMap } from '@/lib/financial/account-hierarchy'
import { serializeJournalEntry } from '@/lib/financial/serializers'

export const journalEntryInclude = {
  company: { select: { id: true, nameEn: true, companyCode: true } },
  createdBy: { select: { id: true, nameEn: true, email: true } },
  lines: {
    include: {
      account: {
        select: { id: true, code: true, name: true, type: true, level: true, parentId: true },
      },
      costCenter: { select: { id: true, code: true, name: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { lineNum: 'asc' as const },
  },
} as const

type JournalEntryRecord = Parameters<typeof serializeJournalEntry>[0]

export async function loadCompanyAccountMap(companyId: string) {
  const accounts = await prisma.finAccount.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true, level: true, parentId: true },
  })
  return buildAccountByIdMap(accounts)
}

export function serializeJournalEntryWithHierarchy(
  entry: JournalEntryRecord,
  accountById?: Map<string, { id: string; code: string; name: string; level: number; parentId: string | null }>,
) {
  return serializeJournalEntry(entry, { accountById })
}

export async function serializeJournalEntriesWithHierarchy(entries: JournalEntryRecord[]) {
  if (entries.length === 0) return []

  const companyIds = [...new Set(entries.map(entry => entry.companyId).filter(Boolean))] as string[]
  const accountMaps = new Map<string, Awaited<ReturnType<typeof loadCompanyAccountMap>>>()

  await Promise.all(
    companyIds.map(async companyId => {
      accountMaps.set(companyId, await loadCompanyAccountMap(companyId))
    }),
  )

  return entries.map(entry =>
    serializeJournalEntry(entry, {
      accountById: entry.companyId ? accountMaps.get(entry.companyId) : undefined,
    }),
  )
}
