import { compareTwoStrings } from 'string-similarity'
import { prisma } from '@/lib/db/prisma'
import type { AMLEntityType, AMLCheckResult, AMLSubjectType } from '@prisma/client'

const STRONG_HIT_THRESHOLD = 0.98
const POTENTIAL_HIT_THRESHOLD = 0.92
const WEAK_HIT_THRESHOLD = 0.85

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreNames(candidate: string, targets: string[]): number {
  const normCandidate = normalize(candidate)
  if (!normCandidate) return 0
  let best = 0
  for (const t of targets) {
    const normT = normalize(t)
    if (!normT) continue
    const score = compareTwoStrings(normCandidate, normT)
    if (score > best) best = score
  }
  return best
}

function classify(score: number): AMLCheckResult | null {
  if (score >= STRONG_HIT_THRESHOLD) return 'STRONG_HIT'
  if (score >= POTENTIAL_HIT_THRESHOLD) return 'POTENTIAL_HIT'
  if (score >= WEAK_HIT_THRESHOLD) return 'WEAK_HIT'
  return null
}

export interface MatchDetail {
  amlRecordId: string
  primaryName: string
  score: number
  result: AMLCheckResult
}

export async function screenSubjectNames({
  names,
  dateOfBirth,
  entityType,
}: {
  names: string[]
  dateOfBirth?: Date | null
  entityType?: AMLEntityType
}): Promise<{ result: AMLCheckResult; matches: MatchDetail[] }> {
  const subjectNames = names.filter(Boolean)

  const records = await prisma.aMLRecord.findMany({
    ...(entityType ? { where: { entityType } } : {}),
    select: { id: true, primaryName: true, aliases: true, dateOfBirth: true },
  })
  if (records.length === 0) {
    throw new Error('AML screening cannot run because no sanctions records are loaded. Please ingest sanctions lists first.')
  }

  const matches: MatchDetail[] = []
  let overallResult: AMLCheckResult = 'CLEAR'

  for (const record of records) {
    const targets = [record.primaryName, ...record.aliases]
    let bestScore = 0
    for (const subjectName of subjectNames) {
      const score = scoreNames(subjectName, targets)
      if (score > bestScore) bestScore = score
    }

    const result = classify(bestScore)
    if (!result) continue

    let finalResult = result
    if (entityType !== 'ENTITY' && result === 'POTENTIAL_HIT' && dateOfBirth && record.dateOfBirth) {
      const sameYear = dateOfBirth.getFullYear() === record.dateOfBirth.getFullYear()
      const sameMonth = dateOfBirth.getMonth() === record.dateOfBirth.getMonth()
      if (sameYear && sameMonth) finalResult = 'STRONG_HIT'
    }

    matches.push({ amlRecordId: record.id, primaryName: record.primaryName, score: bestScore, result: finalResult })

    const rank: Record<AMLCheckResult, number> = { CLEAR: 0, WEAK_HIT: 1, POTENTIAL_HIT: 2, STRONG_HIT: 3 }
    if (rank[finalResult] > rank[overallResult]) overallResult = finalResult
  }

  return { result: overallResult, matches }
}

export async function screenKeyPerson(
  keyPersonId: string,
  trigger: 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT',
  triggeredById?: string
): Promise<AMLCheckResult> {
  const person = await prisma.keyPerson.findUnique({ where: { id: keyPersonId } })
  if (!person) throw new Error(`KeyPerson ${keyPersonId} not found`)

  const subjectNames = [person.nameEn, person.nameZh].filter(Boolean) as string[]

  const { result: overallResult, matches } = await screenSubjectNames({
    names: subjectNames,
    dateOfBirth: person.dateOfBirth,
    entityType: 'INDIVIDUAL',
  })

  await prisma.aMLCheck.create({
    data: {
      subjectType: 'KEY_PERSON' as AMLSubjectType,
      keyPersonId,
      trigger,
      triggeredById,
      result: overallResult,
      matches: matches as never,
    },
  })

  for (const match of matches) {
    await prisma.aMLAlert.create({
      data: {
        amlRecordId: match.amlRecordId,
        subjectType: 'KEY_PERSON' as AMLSubjectType,
        keyPersonId,
        matchScore: match.score,
        result: match.result,
      },
    })
  }

  return overallResult
}

export async function screenCompany(
  companyId: string,
  trigger: 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT',
  triggeredById?: string
): Promise<AMLCheckResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameEn: true, nameZh: true },
  })
  if (!company) throw new Error(`Company ${companyId} not found`)

  const subjectNames = [company.nameEn, company.nameZh].filter(Boolean) as string[]

  const { result: overallResult, matches } = await screenSubjectNames({
    names: subjectNames,
    entityType: 'ENTITY',
  })

  await prisma.aMLCheck.create({
    data: {
      subjectType: 'COMPANY' as AMLSubjectType,
      companyId,
      trigger,
      triggeredById,
      result: overallResult,
      matches: matches as never,
    },
  })

  for (const match of matches) {
    await prisma.aMLAlert.create({
      data: {
        amlRecordId: match.amlRecordId,
        subjectType: 'COMPANY' as AMLSubjectType,
        companyId,
        matchScore: match.score,
        result: match.result,
      },
    })
  }

  return overallResult
}

export async function screenAll(
  trigger: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
): Promise<{ keyPersons: number; companies: number; hits: number }> {
  const [keyPersons, companies] = await Promise.all([
    prisma.keyPerson.findMany({ select: { id: true } }),
    prisma.company.findMany({ where: { status: { not: 'DEREGISTERED' } }, select: { id: true } }),
  ])

  let hits = 0
  for (const kp of keyPersons) {
    const result = await screenKeyPerson(kp.id, trigger)
    if (result !== 'CLEAR') hits++
  }
  for (const co of companies) {
    const result = await screenCompany(co.id, trigger)
    if (result !== 'CLEAR') hits++
  }

  return { keyPersons: keyPersons.length, companies: companies.length, hits }
}
