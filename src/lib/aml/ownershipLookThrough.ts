/**
 * Company ownership look-through for DDR / CDD.
 * Effective beneficial ownership = product of ownership fractions along each path,
 * summed across paths. AMLO / CR TCSP guideline uses more than 25%.
 */

import { prisma } from '@/lib/db/prisma'

export const UBO_EFFECTIVE_THRESHOLD_PCT = 25

export type CompanyWithMembers = {
  id: string
  nameEn: string
  nameZh: string | null
  companyNumber: string | null
  members: {
    id: string
    keyPersonId: string | null
    nameEn: string
    nameZh: string | null
    shareClass: string
    status: string
    shareTransactions: { sharesHeld: number; transactionDate: Date }[]
  }[]
}

export type OwnershipNode = {
  id: string
  type: 'COMPANY' | 'PERSON'
  nameEn: string
  nameZh: string | null
  companyId: string | null
  companyNumber: string | null
  keyPersonId: string | null
  shareClass: string | null
  sharesHeld: number | null
  /** Direct ownership % at this layer */
  ownershipPercent: number | null
  circular: boolean
  children: OwnershipNode[]
}

export type EffectiveNaturalOwner = {
  key: string
  keyPersonId: string | null
  nameEn: string
  nameZh: string | null
  /** Aggregated look-through ownership of the root company, 0–100 */
  effectivePercent: number
}

function normalizeName(name: string | null | undefined) {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,，。()（）]/g, '')
    .replace(/\s+/g, ' ')
}

function latestShares(member: CompanyWithMembers['members'][number]) {
  return member.shareTransactions[0]?.sharesHeld ?? null
}

export function indexCompaniesByName(companies: CompanyWithMembers[]) {
  const byName = new Map<string, CompanyWithMembers>()
  for (const company of companies) {
    for (const name of [company.nameEn, company.nameZh]) {
      const normalized = normalizeName(name)
      if (normalized && !byName.has(normalized)) byName.set(normalized, company)
    }
  }
  return byName
}

export function buildCompanyOwnershipNode(
  company: CompanyWithMembers,
  byName: Map<string, CompanyWithMembers>,
  visited: Set<string>,
  meta?: Pick<OwnershipNode, 'shareClass' | 'sharesHeld' | 'ownershipPercent'>,
): OwnershipNode {
  if (visited.has(company.id)) {
    return {
      id: company.id,
      type: 'COMPANY',
      nameEn: company.nameEn,
      nameZh: company.nameZh,
      companyId: company.id,
      companyNumber: company.companyNumber,
      keyPersonId: null,
      shareClass: meta?.shareClass ?? null,
      sharesHeld: meta?.sharesHeld ?? null,
      ownershipPercent: meta?.ownershipPercent ?? null,
      circular: true,
      children: [],
    }
  }

  const nextVisited = new Set(visited)
  nextVisited.add(company.id)
  const activeMembers = company.members.filter(member => member.status === 'ACTIVE')
  const totalShares = activeMembers.reduce((sum, member) => sum + (latestShares(member) ?? 0), 0)

  return {
    id: company.id,
    type: 'COMPANY',
    nameEn: company.nameEn,
    nameZh: company.nameZh,
    companyId: company.id,
    companyNumber: company.companyNumber,
    keyPersonId: null,
    shareClass: meta?.shareClass ?? null,
    sharesHeld: meta?.sharesHeld ?? null,
    ownershipPercent: meta?.ownershipPercent ?? null,
    circular: false,
    children: activeMembers.map(member => {
      const sharesHeld = latestShares(member)
      const ownershipPercent = totalShares > 0 && sharesHeld != null
        ? Number(((sharesHeld / totalShares) * 100).toFixed(4))
        : null
      const matchedCompany = byName.get(normalizeName(member.nameEn))
        ?? byName.get(normalizeName(member.nameZh))
      const metaForMember = {
        shareClass: member.shareClass,
        sharesHeld,
        ownershipPercent,
      }

      if (matchedCompany && matchedCompany.id !== company.id) {
        return buildCompanyOwnershipNode(matchedCompany, byName, nextVisited, metaForMember)
      }

      return {
        id: member.id,
        type: 'PERSON' as const,
        nameEn: member.nameEn,
        nameZh: member.nameZh,
        companyId: null,
        companyNumber: null,
        keyPersonId: member.keyPersonId,
        shareClass: member.shareClass,
        sharesHeld,
        ownershipPercent,
        circular: false,
        children: [],
      }
    }),
  }
}

function personKey(opts: { keyPersonId?: string | null; nameEn: string; nameZh?: string | null }) {
  if (opts.keyPersonId) return `kp:${opts.keyPersonId}`
  return `name:${normalizeName(opts.nameEn)}:${normalizeName(opts.nameZh)}`
}

/**
 * Walk ownership tree from root; accumulate effective ownership for natural persons.
 * pathFactor is the fraction of the root owned so far (1 at root).
 */
function accumulateEffective(
  node: OwnershipNode,
  pathFactor: number,
  acc: Map<string, EffectiveNaturalOwner>,
) {
  if (node.type === 'PERSON') {
    const directFrac = (node.ownershipPercent ?? 0) / 100
    const effective = pathFactor * directFrac * 100
    if (effective <= 0) return
    const key = personKey({
      keyPersonId: node.keyPersonId,
      nameEn: node.nameEn,
      nameZh: node.nameZh,
    })
    const existing = acc.get(key)
    if (existing) {
      existing.effectivePercent = Number((existing.effectivePercent + effective).toFixed(4))
      if (!existing.keyPersonId && node.keyPersonId) existing.keyPersonId = node.keyPersonId
    } else {
      acc.set(key, {
        key,
        keyPersonId: node.keyPersonId,
        nameEn: node.nameEn,
        nameZh: node.nameZh,
        effectivePercent: Number(effective.toFixed(4)),
      })
    }
    return
  }

  // COMPANY node: children are held relative to this company
  for (const child of node.children) {
    if (child.circular) continue
    if (child.type === 'COMPANY') {
      const childFrac = (child.ownershipPercent ?? 0) / 100
      accumulateEffective(child, pathFactor * childFrac, acc)
    } else {
      accumulateEffective(child, pathFactor, acc)
    }
  }
}

export function computeEffectiveNaturalOwners(
  root: OwnershipNode,
  thresholdPct = UBO_EFFECTIVE_THRESHOLD_PCT,
): EffectiveNaturalOwner[] {
  const acc = new Map<string, EffectiveNaturalOwner>()
  accumulateEffective(root, 1, acc)
  return [...acc.values()]
    .filter(o => o.effectivePercent > thresholdPct)
    .sort((a, b) => b.effectivePercent - a.effectivePercent)
}

export async function loadAllCompaniesWithMembers(): Promise<CompanyWithMembers[]> {
  return prisma.company.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      nameEn: true,
      nameZh: true,
      companyNumber: true,
      members: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          keyPersonId: true,
          nameEn: true,
          nameZh: true,
          shareClass: true,
          status: true,
          shareTransactions: {
            orderBy: { transactionDate: 'desc' },
            take: 1,
            select: { sharesHeld: true, transactionDate: true },
          },
        },
      },
    },
  })
}

export async function getOwnershipStructureForCompany(companyId: string): Promise<{
  structure: OwnershipNode
  ubos: EffectiveNaturalOwner[]
} | null> {
  const companies = await loadAllCompaniesWithMembers()
  const root = companies.find(c => c.id === companyId)
  if (!root) return null
  const structure = buildCompanyOwnershipNode(root, indexCompaniesByName(companies), new Set())
  const ubos = computeEffectiveNaturalOwners(structure)
  return { structure, ubos }
}

export type DdrScreeningSubject = {
  key: string
  keyPersonId: string | null
  nameEn: string
  nameZh: string | null
  roles: string[]
  /** Look-through ownership of subject company when UBO; else null */
  effectivePercent: number | null
  idType: string | null
  idNumber: string | null
  nationality: string | null
  dateOfBirth: Date | null
  placeOfBirth: string | null
  placeOfIssue: string | null
}

function addRole(roles: string[], role: string) {
  if (!roles.includes(role)) roles.push(role)
}

/**
 * Build the natural-person screening set for a company DDR:
 * - UBOs with effective ownership > 25%
 * - All active natural-person directors
 * - All natural-person significant controllers
 */
export async function collectCompanyDdrScreeningSubjects(
  companyId: string,
): Promise<{
  structure: OwnershipNode
  ubos: EffectiveNaturalOwner[]
  subjects: DdrScreeningSubject[]
} | null> {
  const ownership = await getOwnershipStructureForCompany(companyId)
  if (!ownership) return null

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      directors: {
        where: { status: 'ACTIVE' },
        orderBy: { dateOfAppointment: 'asc' },
      },
      significantControllers: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!company) return null

  const byKey = new Map<string, DdrScreeningSubject>()

  function upsert(partial: Omit<DdrScreeningSubject, 'roles'> & { role: string }) {
    const existing = byKey.get(partial.key)
    if (existing) {
      addRole(existing.roles, partial.role)
      if (partial.effectivePercent != null) {
        existing.effectivePercent = Math.max(
          existing.effectivePercent ?? 0,
          partial.effectivePercent,
        )
      }
      if (!existing.keyPersonId && partial.keyPersonId) existing.keyPersonId = partial.keyPersonId
      if (!existing.idNumber && partial.idNumber) existing.idNumber = partial.idNumber
      if (!existing.nationality && partial.nationality) existing.nationality = partial.nationality
      if (!existing.dateOfBirth && partial.dateOfBirth) existing.dateOfBirth = partial.dateOfBirth
      if (!existing.placeOfBirth && partial.placeOfBirth) existing.placeOfBirth = partial.placeOfBirth
      if (!existing.placeOfIssue && partial.placeOfIssue) existing.placeOfIssue = partial.placeOfIssue
      return
    }
    byKey.set(partial.key, {
      key: partial.key,
      keyPersonId: partial.keyPersonId,
      nameEn: partial.nameEn,
      nameZh: partial.nameZh,
      roles: [partial.role],
      effectivePercent: partial.effectivePercent,
      idType: partial.idType,
      idNumber: partial.idNumber,
      nationality: partial.nationality,
      dateOfBirth: partial.dateOfBirth,
      placeOfBirth: partial.placeOfBirth,
      placeOfIssue: partial.placeOfIssue,
    })
  }

  for (const ubo of ownership.ubos) {
    upsert({
      key: ubo.key,
      keyPersonId: ubo.keyPersonId,
      nameEn: ubo.nameEn,
      nameZh: ubo.nameZh,
      role: `Beneficial Owner (effective ${ubo.effectivePercent.toFixed(2)}%)`,
      effectivePercent: ubo.effectivePercent,
      idType: null,
      idNumber: null,
      nationality: null,
      dateOfBirth: null,
      placeOfBirth: null,
      placeOfIssue: null,
    })
  }

  for (const d of company.directors) {
    if (d.isCorporation) continue
    upsert({
      key: personKey({ keyPersonId: d.keyPersonId, nameEn: d.nameEn, nameZh: d.nameZh }),
      keyPersonId: d.keyPersonId,
      nameEn: d.nameEn,
      nameZh: d.nameZh,
      role: 'Director',
      effectivePercent: null,
      idType: d.idType,
      idNumber: d.idNumber,
      nationality: d.nationality,
      dateOfBirth: d.dateOfBirth,
      placeOfBirth: d.placeOfBirth,
      placeOfIssue: d.countryOfIssuance,
    })
  }

  for (const c of company.significantControllers) {
    if (c.isLegalEntity) continue
    upsert({
      key: personKey({ keyPersonId: c.keyPersonId, nameEn: c.nameEn, nameZh: c.nameZh }),
      keyPersonId: c.keyPersonId,
      nameEn: c.nameEn,
      nameZh: c.nameZh,
      role: 'Significant Controller',
      effectivePercent: null,
      idType: c.idType,
      idNumber: c.idPassportNo,
      nationality: c.issuingCountry,
      dateOfBirth: null,
      placeOfBirth: null,
      placeOfIssue: c.issuingCountry,
    })
  }

  // Enrich from KeyPerson records when linked
  const kpIds = [...byKey.values()].map(s => s.keyPersonId).filter((id): id is string => Boolean(id))
  if (kpIds.length > 0) {
    const kps = await prisma.keyPerson.findMany({
      where: { id: { in: kpIds } },
      select: {
        id: true,
        nameEn: true,
        nameZh: true,
        idType: true,
        idNumber: true,
        nationality: true,
        dateOfBirth: true,
        placeOfBirth: true,
        placeOfIssue: true,
      },
    })
    const kpMap = new Map(kps.map(k => [k.id, k]))
    for (const s of byKey.values()) {
      if (!s.keyPersonId) continue
      const kp = kpMap.get(s.keyPersonId)
      if (!kp) continue
      s.nameEn = kp.nameEn || s.nameEn
      s.nameZh = kp.nameZh ?? s.nameZh
      s.idType = kp.idType ?? s.idType
      s.idNumber = kp.idNumber ?? s.idNumber
      s.nationality = kp.nationality ?? s.nationality
      s.dateOfBirth = kp.dateOfBirth ?? s.dateOfBirth
      s.placeOfBirth = kp.placeOfBirth ?? s.placeOfBirth
      s.placeOfIssue = kp.placeOfIssue ?? s.placeOfIssue
    }
  }

  const subjects = [...byKey.values()].sort((a, b) => {
    const ap = a.effectivePercent ?? -1
    const bp = b.effectivePercent ?? -1
    if (bp !== ap) return bp - ap
    return a.nameEn.localeCompare(b.nameEn)
  })

  return { structure: ownership.structure, ubos: ownership.ubos, subjects }
}
