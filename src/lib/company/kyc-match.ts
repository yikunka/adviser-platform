import { prisma } from '@/lib/db/prisma'

export type KeyPersonMatch = {
  id: string
  nameEn: string
  nameZh: string | null
  idNumber: string | null
  idType: string | null
  nationality: string | null
  placeOfIssue: string | null
  homeAddress: string | null
  contactAddress: string | null
}

export function normalizePersonName(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
}

export function namesMatch(
  aEn: string,
  aZh: string | null | undefined,
  bEn: string,
  bZh: string | null | undefined,
): boolean {
  const enA = normalizePersonName(aEn)
  const enB = normalizePersonName(bEn)
  if (enA && enB && enA === enB) return true

  const zhA = normalizePersonName(aZh)
  const zhB = normalizePersonName(bZh)
  if (zhA && zhB && zhA === zhB) return true

  return false
}

export async function loadKeyPersonCandidates(companyId: string): Promise<KeyPersonMatch[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { clientUserId: true },
  })

  const filters: Array<Record<string, unknown>> = [
    { companyLinks: { some: { companyId } } },
  ]
  if (company?.clientUserId) {
    filters.push({ submittedByUserId: company.clientUserId })
  }

  return prisma.keyPerson.findMany({
    where: { OR: filters as never },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      nameEn: true,
      nameZh: true,
      idNumber: true,
      idType: true,
      nationality: true,
      placeOfIssue: true,
      homeAddress: true,
      contactAddress: true,
    },
  })
}

export function matchKeyPersonByName(
  candidates: KeyPersonMatch[],
  nameEn: string,
  nameZh?: string | null,
  idNumber?: string | null,
): KeyPersonMatch | null {
  const normalizedId = normalizePersonName(idNumber)
  if (normalizedId) {
    const byId = candidates.find(c => normalizePersonName(c.idNumber) === normalizedId)
    if (byId) return byId
  }

  const exact = candidates.find(c => namesMatch(nameEn, nameZh, c.nameEn, c.nameZh))
  if (exact) return exact

  const enOnly = normalizePersonName(nameEn)
  if (enOnly) {
    const byEn = candidates.find(c => normalizePersonName(c.nameEn) === enOnly)
    if (byEn) return byEn
  }

  return null
}

export function parseFlexibleDate(value: string | null | undefined, fallback?: Date | null): Date {
  const fb = fallback ?? new Date()
  if (!value?.trim()) return fb
  const raw = value.trim()
  const iso = new Date(raw)
  if (!Number.isNaN(iso.getTime())) return iso

  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymd) {
    return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])))
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])))
  }

  return fb
}

export function mapShareClass(value: string | null | undefined): 'ORDINARY' | 'PREFERENCE' | 'OTHER' {
  const raw = (value ?? '').trim().toLowerCase()
  if (raw.includes('prefer')) return 'PREFERENCE'
  if (raw.includes('ordinary') || raw.includes('普通')) return 'ORDINARY'
  if (!raw) return 'ORDINARY'
  return 'OTHER'
}

export function mapIdType(value: string | null | undefined): 'HKID' | 'PASSPORT' | 'OTHER' | undefined {
  const raw = (value ?? '').trim().toUpperCase()
  if (raw === 'HKID') return 'HKID'
  if (raw === 'PASSPORT') return 'PASSPORT'
  if (raw === 'OTHER') return 'OTHER'
  if (raw.includes('HKID') || raw.includes('香港')) return 'HKID'
  if (raw.includes('PASSPORT') || raw.includes('護照') || raw.includes('护照')) return 'PASSPORT'
  return undefined
}
