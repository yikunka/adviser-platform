import type { JournalSourceType } from '@prisma/client'

const DIRECTLY_UNPOSTABLE_JOURNAL_SOURCE_TYPES: ReadonlySet<JournalSourceType> = new Set([
  'MANUAL',
  'CLOSING',
])

export function isDirectlyUnpostableJournalSourceType(sourceType: JournalSourceType | string | null | undefined) {
  return DIRECTLY_UNPOSTABLE_JOURNAL_SOURCE_TYPES.has((sourceType ?? 'MANUAL') as JournalSourceType)
}

export function journalSourceTypeListLabel(sourceType: JournalSourceType | string | null | undefined) {
  if (!sourceType || sourceType === 'MANUAL') return '手工'
  if (sourceType === 'CLOSING') return '结转'
  return '自动'
}
