import { prisma } from '@/lib/db/prisma'

export type RelatedCompanyRole =
  | 'CLIENT_ACCOUNT'
  | 'LINKED'
  | 'DIRECTOR'
  | 'MEMBER'
  | 'SIGNIFICANT_CONTROLLER'
  | 'DESIGNATED_REPRESENTATIVE'

export type RelatedCompany = {
  id: string
  nameEn: string
  nameZh: string | null
  companyNumber: string | null
  status: string
  roles: RelatedCompanyRole[]
}

type PersonRef = {
  id: string
  submittedByUserId?: string | null
  submittedByEmail?: string | null
}

type CompanySnap = {
  id: string
  nameEn: string
  nameZh: string | null
  companyNumber: string | null
  status: string
}

function emptyMap(personIds: string[]): Map<string, Map<string, RelatedCompany>> {
  const out = new Map<string, Map<string, RelatedCompany>>()
  for (const id of personIds) out.set(id, new Map())
  return out
}

function upsert(
  byPerson: Map<string, Map<string, RelatedCompany>>,
  personId: string,
  company: CompanySnap,
  role: RelatedCompanyRole,
) {
  const companies = byPerson.get(personId)
  if (!companies) return
  const existing = companies.get(company.id)
  if (existing) {
    if (!existing.roles.includes(role)) existing.roles.push(role)
    return
  }
  companies.set(company.id, {
    id: company.id,
    nameEn: company.nameEn,
    nameZh: company.nameZh,
    companyNumber: company.companyNumber,
    status: company.status,
    roles: [role],
  })
}

const companySelect = {
  id: true,
  nameEn: true,
  nameZh: true,
  companyNumber: true,
  status: true,
} as const

function toList(byPerson: Map<string, Map<string, RelatedCompany>>): Record<string, RelatedCompany[]> {
  const out: Record<string, RelatedCompany[]> = {}
  for (const [personId, companies] of byPerson) {
    out[personId] = [...companies.values()].sort((a, b) =>
      a.nameEn.localeCompare(b.nameEn, undefined, { sensitivity: 'base' }),
    )
  }
  return out
}

/**
 * Resolve companies related to KYC persons via:
 * - portal client account (`Company.clientUserId` / `pendingClientEmail`)
 * - explicit `CompanyKeyPerson` links
 * - director / member / significant controller / designated representative `keyPersonId`
 */
export async function getRelatedCompaniesForKeyPersons(
  persons: PersonRef[],
): Promise<Record<string, RelatedCompany[]>> {
  if (persons.length === 0) return {}

  const personIds = persons.map(p => p.id)
  const byPerson = emptyMap(personIds)

  const userIds = [...new Set(persons.map(p => p.submittedByUserId).filter(Boolean))] as string[]
  const emails = [
    ...new Set(
      persons
        .map(p => p.submittedByEmail?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ]

  const [directors, members, controllers, designatedReps, links, clientCompanies, pendingCompanies] = await Promise.all([
    prisma.director.findMany({
      where: { keyPersonId: { in: personIds }, company: { deletedAt: null } },
      select: { keyPersonId: true, company: { select: companySelect } },
    }),
    prisma.member.findMany({
      where: { keyPersonId: { in: personIds }, company: { deletedAt: null } },
      select: { keyPersonId: true, company: { select: companySelect } },
    }),
    prisma.significantController.findMany({
      where: { keyPersonId: { in: personIds }, company: { deletedAt: null } },
      select: { keyPersonId: true, company: { select: companySelect } },
    }),
    prisma.designatedRepresentative.findMany({
      where: { keyPersonId: { in: personIds }, company: { deletedAt: null } },
      select: { keyPersonId: true, company: { select: companySelect } },
    }),
    prisma.companyKeyPerson.findMany({
      where: { keyPersonId: { in: personIds }, company: { deletedAt: null } },
      select: { keyPersonId: true, company: { select: companySelect } },
    }),
    userIds.length
      ? prisma.company.findMany({
          where: { clientUserId: { in: userIds }, deletedAt: null },
          select: { ...companySelect, clientUserId: true },
        })
      : Promise.resolve([]),
    emails.length
      ? prisma.company.findMany({
          where: { pendingClientEmail: { in: emails }, deletedAt: null },
          select: { ...companySelect, pendingClientEmail: true },
        })
      : Promise.resolve([]),
  ])

  for (const row of directors) {
    if (row.keyPersonId) upsert(byPerson, row.keyPersonId, row.company, 'DIRECTOR')
  }
  for (const row of members) {
    if (row.keyPersonId) upsert(byPerson, row.keyPersonId, row.company, 'MEMBER')
  }
  for (const row of controllers) {
    if (row.keyPersonId) upsert(byPerson, row.keyPersonId, row.company, 'SIGNIFICANT_CONTROLLER')
  }
  for (const row of designatedReps) {
    if (row.keyPersonId) upsert(byPerson, row.keyPersonId, row.company, 'DESIGNATED_REPRESENTATIVE')
  }
  for (const row of links) {
    upsert(byPerson, row.keyPersonId, row.company, 'LINKED')
  }

  const userIdToPersons = new Map<string, string[]>()
  const emailToPersons = new Map<string, string[]>()
  for (const p of persons) {
    if (p.submittedByUserId) {
      const list = userIdToPersons.get(p.submittedByUserId) ?? []
      list.push(p.id)
      userIdToPersons.set(p.submittedByUserId, list)
    }
    const email = p.submittedByEmail?.trim().toLowerCase()
    if (email) {
      const list = emailToPersons.get(email) ?? []
      list.push(p.id)
      emailToPersons.set(email, list)
    }
  }

  for (const co of clientCompanies) {
    if (!co.clientUserId) continue
    for (const personId of userIdToPersons.get(co.clientUserId) ?? []) {
      upsert(byPerson, personId, co, 'CLIENT_ACCOUNT')
    }
  }
  for (const co of pendingCompanies) {
    if (!co.pendingClientEmail) continue
    for (const personId of emailToPersons.get(co.pendingClientEmail) ?? []) {
      upsert(byPerson, personId, co, 'CLIENT_ACCOUNT')
    }
  }

  return toList(byPerson)
}

export async function getRelatedCompaniesForKeyPerson(person: PersonRef): Promise<RelatedCompany[]> {
  const map = await getRelatedCompaniesForKeyPersons([person])
  return map[person.id] ?? []
}

export function relatedCompanyRoleLabel(role: RelatedCompanyRole): string {
  switch (role) {
    case 'CLIENT_ACCOUNT':
      return 'Client account'
    case 'LINKED':
      return 'Linked'
    case 'DIRECTOR':
      return 'Director'
    case 'MEMBER':
      return 'Member'
    case 'SIGNIFICANT_CONTROLLER':
      return 'Significant controller'
    case 'DESIGNATED_REPRESENTATIVE':
      return 'Designated representative'
    default:
      return role
  }
}
