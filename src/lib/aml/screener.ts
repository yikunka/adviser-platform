import { compareTwoStrings } from 'string-similarity'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import type { AMLCheckResult, AMLEntityType, AMLScreenScope, AMLSubjectType } from '@prisma/client'
import { runAdverseMediaScreen, shouldRunAdverseMedia } from './adverseMedia'
import { matchOpenSanctionsPep } from './openSanctionsPep'

const STRONG_HIT_THRESHOLD = 0.98
const POTENTIAL_HIT_THRESHOLD = 0.92
const WEAK_HIT_THRESHOLD = 0.85

const FATF_SEQ = [14, 15]
const OPENSANCTIONS_PEP_SEQ = 16

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

/** Jurisdiction / passport-country match: exact, containment, then fuzzy. */
function scoreJurisdiction(subject: string, targets: string[]): number {
  const normSubject = normalize(subject)
  if (!normSubject) return 0
  let best = 0
  for (const t of targets) {
    const normT = normalize(t)
    if (!normT) continue
    if (normSubject === normT) return 1
    // e.g. "Tehran Iran" contains "Iran"; Chinese "伊朗德黑兰" contains "伊朗"
    if (normSubject.includes(normT) || normT.includes(normSubject)) {
      best = Math.max(best, 0.95)
      continue
    }
    best = Math.max(best, compareTwoStrings(normSubject, normT))
  }
  return best
}

function personJurisdictionSubjects(person: {
  nationality?: string | null
  placeOfIssue?: string | null
  placeOfBirth?: string | null
}): string[] {
  const values = [person.nationality, person.placeOfIssue, person.placeOfBirth]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
  // De-dupe case-insensitively while keeping first spelling
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = normalize(v)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function classify(score: number): AMLCheckResult | null {
  if (score >= STRONG_HIT_THRESHOLD) return 'STRONG_HIT'
  if (score >= POTENTIAL_HIT_THRESHOLD) return 'POTENTIAL_HIT'
  if (score >= WEAK_HIT_THRESHOLD) return 'WEAK_HIT'
  return null
}

const RESULT_RANK: Record<AMLCheckResult, number> = {
  CLEAR: 0,
  WEAK_HIT: 1,
  POTENTIAL_HIT: 2,
  STRONG_HIT: 3,
}

export interface MatchDetail {
  amlRecordId: string
  primaryName: string
  score: number
  result: AMLCheckResult
}

export type ScreenScope = Extract<AMLScreenScope, 'SANCTIONS' | 'FATF' | 'PEP' | 'FULL'>

async function ensureOpenSanctionsPepSource() {
  return prisma.aMLSource.upsert({
    where: { seqNo: OPENSANCTIONS_PEP_SEQ },
    update: {
      nameEn: 'OpenSanctions PEP',
      nameZh: 'OpenSanctions 政治公眾人物',
      sourceUrl: 'api:opensanctions/match/peps',
      format: 'JSON',
      isActive: true,
    },
    create: {
      seqNo: OPENSANCTIONS_PEP_SEQ,
      nameEn: 'OpenSanctions PEP',
      nameZh: 'OpenSanctions 政治公眾人物',
      sourceUrl: 'api:opensanctions/match/peps',
      format: 'JSON',
      isActive: true,
    },
  })
}

export async function screenSubjectNames({
  names,
  dateOfBirth,
  entityType,
  scope = 'FULL',
  matchMode = 'NAME',
}: {
  names: string[]
  dateOfBirth?: Date | null
  entityType?: AMLEntityType
  scope?: Exclude<ScreenScope, 'PEP'>
  /** NAME = person/company names; JURISDICTION = nationality / passport issue / birth place vs FATF countries */
  matchMode?: 'NAME' | 'JURISDICTION'
}): Promise<{ result: AMLCheckResult; matches: MatchDetail[] }> {
  const subjectNames = names.filter(Boolean)

  const sanctionsSource = { seqNo: { notIn: [...FATF_SEQ, OPENSANCTIONS_PEP_SEQ] } }
  const fatfSource = { seqNo: { in: FATF_SEQ } }

  // FATF lists are jurisdictions stored as ENTITY — they must be screened regardless of the
  // subject's entity type. Only sanctions records are filtered by entityType, to avoid
  // person↔company false positives.
  const where =
    scope === 'SANCTIONS'
      ? { ...(entityType ? { entityType } : {}), source: sanctionsSource }
      : scope === 'FATF'
        ? { source: fatfSource }
        : {
            OR: [
              { source: fatfSource },
              { ...(entityType ? { entityType } : {}), source: sanctionsSource },
            ],
          }

  const records = await prisma.aMLRecord.findMany({
    where,
    select: { id: true, primaryName: true, aliases: true, dateOfBirth: true },
  })
  if (records.length === 0) {
    const label = scope === 'FATF' ? 'FATF' : scope === 'SANCTIONS' ? 'sanctions' : 'AML'
    throw new Error(`${label} screening cannot run because no records are loaded. Please ingest lists first.`)
  }

  const scoreFn = matchMode === 'JURISDICTION' ? scoreJurisdiction : scoreNames
  const matches: MatchDetail[] = []
  let overallResult: AMLCheckResult = 'CLEAR'

  for (const record of records) {
    const targets = [record.primaryName, ...record.aliases]
    let bestScore = 0
    for (const subjectName of subjectNames) {
      const score = scoreFn(subjectName, targets)
      if (score > bestScore) bestScore = score
    }

    const result = classify(bestScore)
    if (!result) continue

    let finalResult = result
    if (
      matchMode === 'NAME'
      && entityType !== 'ENTITY'
      && result === 'POTENTIAL_HIT'
      && dateOfBirth
      && record.dateOfBirth
    ) {
      const sameYear = dateOfBirth.getFullYear() === record.dateOfBirth.getFullYear()
      const sameMonth = dateOfBirth.getMonth() === record.dateOfBirth.getMonth()
      if (sameYear && sameMonth) finalResult = 'STRONG_HIT'
    }

    matches.push({ amlRecordId: record.id, primaryName: record.primaryName, score: bestScore, result: finalResult })

    if (RESULT_RANK[finalResult] > RESULT_RANK[overallResult]) overallResult = finalResult
  }

  return { result: overallResult, matches }
}

async function screenPersonFatfJurisdictions(person: {
  nationality?: string | null
  placeOfIssue?: string | null
  placeOfBirth?: string | null
}): Promise<{ result: AMLCheckResult; matches: MatchDetail[] }> {
  const jurisdictions = personJurisdictionSubjects(person)
  if (jurisdictions.length === 0) {
    throw new Error(
      'FATF screening needs nationality, passport/ID place of issue, or place of birth on the KYC record',
    )
  }
  return screenSubjectNames({
    names: jurisdictions,
    entityType: 'ENTITY',
    scope: 'FATF',
    matchMode: 'JURISDICTION',
  })
}

function mergeScreenResults(
  parts: Array<{ result: AMLCheckResult; matches: MatchDetail[] }>,
): { result: AMLCheckResult; matches: MatchDetail[] } {
  let overall: AMLCheckResult = 'CLEAR'
  const matches: MatchDetail[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    if (RESULT_RANK[part.result] > RESULT_RANK[overall]) overall = part.result
    for (const m of part.matches) {
      if (seen.has(m.amlRecordId)) continue
      seen.add(m.amlRecordId)
      matches.push(m)
    }
  }
  return { result: overall, matches }
}

async function persistCheckAndAlerts(opts: {
  subjectType: AMLSubjectType
  keyPersonId?: string
  companyId?: string
  trigger: 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT'
  triggeredById?: string
  scope: AMLScreenScope
  result: AMLCheckResult
  matches: MatchDetail[]
}) {
  await prisma.aMLCheck.create({
    data: {
      subjectType: opts.subjectType,
      keyPersonId: opts.keyPersonId,
      companyId: opts.companyId,
      trigger: opts.trigger,
      triggeredById: opts.triggeredById,
      result: opts.result,
      scope: opts.scope,
      matches: opts.matches as never,
    },
  })

  for (const match of opts.matches) {
    const existing = await prisma.aMLAlert.findFirst({
      where: opts.keyPersonId
        ? { keyPersonId: opts.keyPersonId, amlRecordId: match.amlRecordId }
        : { companyId: opts.companyId!, amlRecordId: match.amlRecordId },
      select: { id: true },
    })
    if (existing) continue

    await prisma.aMLAlert.create({
      data: {
        amlRecordId: match.amlRecordId,
        subjectType: opts.subjectType,
        keyPersonId: opts.keyPersonId,
        companyId: opts.companyId,
        matchScore: match.score,
        result: match.result,
      },
    })
  }
}

export async function screenKeyPerson(
  keyPersonId: string,
  trigger: 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT',
  triggeredById?: string,
  scope: ScreenScope = 'FULL',
): Promise<AMLCheckResult> {
  const person = await prisma.keyPerson.findUnique({ where: { id: keyPersonId } })
  if (!person) throw new Error(`KeyPerson ${keyPersonId} not found`)

  const subjectNames = [person.nameEn, person.nameZh].filter(Boolean) as string[]

  if (scope === 'PEP') {
    const pep = await matchOpenSanctionsPep({
      names: subjectNames,
      dateOfBirth: person.dateOfBirth,
      nationality: person.nationality,
    })
    if (pep.skipped) {
      throw new Error(pep.skipReason || 'OPENSANCTIONS_API_KEY not set — cannot run PEP screening')
    }

    const source = await ensureOpenSanctionsPepSource()
    const matches: MatchDetail[] = []
    for (const hit of pep.hits) {
      const recordHash = createHash('sha256').update(`opensanctions-pep:${hit.id}`).digest('hex')
      const record = await prisma.aMLRecord.upsert({
        where: { sourceId_recordHash: { sourceId: source.id, recordHash } },
        update: {
          primaryName: hit.caption,
          aliases: hit.aliases,
          listingReason: hit.topics.join(', ') || 'OpenSanctions PEP',
          rawData: hit.raw as never,
        },
        create: {
          sourceId: source.id,
          listVersionDate: new Date(),
          entityType: 'INDIVIDUAL',
          primaryName: hit.caption,
          aliases: hit.aliases,
          nationality: hit.nationality,
          listingReason: hit.topics.join(', ') || 'OpenSanctions PEP',
          recordHash,
          rawData: hit.raw as never,
        },
      })
      matches.push({
        amlRecordId: record.id,
        primaryName: hit.caption,
        score: hit.score,
        result: pep.result === 'CLEAR' ? 'WEAK_HIT' : pep.result,
      })
    }

    // Align match results with overall pep.result classification per hit score
    const normalizedMatches = matches.map(m => {
      let result: AMLCheckResult = 'WEAK_HIT'
      if (m.score >= 0.85) result = 'STRONG_HIT'
      else if (m.score >= 0.7) result = 'POTENTIAL_HIT'
      else result = 'WEAK_HIT'
      return { ...m, result }
    })

    await persistCheckAndAlerts({
      subjectType: 'KEY_PERSON',
      keyPersonId,
      trigger,
      triggeredById,
      scope: 'PEP',
      result: pep.result,
      matches: normalizedMatches,
    })

    return pep.result
  }

  let overallResult: AMLCheckResult
  let matches: MatchDetail[]
  let listScope: Exclude<ScreenScope, 'PEP'>

  if (scope === 'FATF') {
    listScope = 'FATF'
    ;({ result: overallResult, matches } = await screenPersonFatfJurisdictions(person))
  } else if (scope === 'SANCTIONS') {
    listScope = 'SANCTIONS'
    ;({ result: overallResult, matches } = await screenSubjectNames({
      names: subjectNames,
      dateOfBirth: person.dateOfBirth,
      entityType: 'INDIVIDUAL',
      scope: 'SANCTIONS',
      matchMode: 'NAME',
    }))
  } else {
    // FULL: sanctions (name) + FATF (passport nationality / issue / birth place)
    listScope = 'FULL'
    const sanctions = await screenSubjectNames({
      names: subjectNames,
      dateOfBirth: person.dateOfBirth,
      entityType: 'INDIVIDUAL',
      scope: 'SANCTIONS',
      matchMode: 'NAME',
    })
    let fatf: { result: AMLCheckResult; matches: MatchDetail[] } = { result: 'CLEAR', matches: [] }
    try {
      fatf = await screenPersonFatfJurisdictions(person)
    } catch (err) {
      // Missing jurisdiction fields: still allow FULL sanctions result; FATF step remains for three-step UI
      console.warn(`[AML] FATF jurisdiction skip for KeyPerson ${keyPersonId}:`, (err as Error).message)
    }
    ;({ result: overallResult, matches } = mergeScreenResults([sanctions, fatf]))
  }

  await persistCheckAndAlerts({
    subjectType: 'KEY_PERSON',
    keyPersonId,
    trigger,
    triggeredById,
    scope: listScope,
    result: overallResult,
    matches,
  })

  if (scope === 'FULL' && shouldRunAdverseMedia(trigger)) {
    try {
      await runAdverseMediaScreen({
        subjectType: 'KEY_PERSON',
        keyPersonId,
        names: subjectNames,
      })
    } catch (err) {
      console.error(`[AML] Adverse media screen failed for KeyPerson ${keyPersonId}:`, (err as Error).message)
    }
  }

  return overallResult
}

export async function screenCompany(
  companyId: string,
  trigger: 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT',
  triggeredById?: string,
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
    scope: 'FULL',
  })

  await persistCheckAndAlerts({
    subjectType: 'COMPANY',
    companyId,
    trigger,
    triggeredById,
    scope: 'FULL',
    result: overallResult,
    matches,
  })

  if (shouldRunAdverseMedia(trigger)) {
    try {
      await runAdverseMediaScreen({
        subjectType: 'COMPANY',
        companyId,
        names: subjectNames,
      })
    } catch (err) {
      console.error(`[AML] Adverse media screen failed for Company ${companyId}:`, (err as Error).message)
    }
  }

  return overallResult
}

export async function screenAll(
  trigger: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED',
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

/** Latest CLEAR required for each scope before DDR. */
export async function getKeyPersonScreenGate(keyPersonId: string) {
  const scopes: Array<'SANCTIONS' | 'FATF' | 'PEP'> = ['SANCTIONS', 'FATF', 'PEP']
  const latest = await Promise.all(
    scopes.map(async scope => {
      const check = await prisma.aMLCheck.findFirst({
        where: { keyPersonId, subjectType: 'KEY_PERSON', scope },
        orderBy: { checkedAt: 'desc' },
        select: { id: true, result: true, checkedAt: true, matches: true },
      })
      return { scope, check }
    }),
  )

  const byScope = Object.fromEntries(
    latest.map(({ scope, check }) => [
      scope,
      (() => {
        const skipped = Boolean(
          check?.matches
          && typeof check.matches === 'object'
          && !Array.isArray(check.matches)
          && (check.matches as { skipped?: boolean }).skipped,
        )
        return check
          ? {
              result: check.result,
              checkedAt: check.checkedAt,
              // Skipped (e.g. missing API key) must never unlock the next step / DDR
              passed: check.result === 'CLEAR' && !skipped,
              skipped,
            }
          : { result: null, checkedAt: null, passed: false, skipped: false }
      })(),
    ]),
  ) as Record<
    'SANCTIONS' | 'FATF' | 'PEP',
    { result: AMLCheckResult | null; checkedAt: Date | null; passed: boolean; skipped: boolean }
  >

  return {
    sanctions: byScope.SANCTIONS,
    fatf: byScope.FATF,
    pep: byScope.PEP,
    canRunFatf: byScope.SANCTIONS.passed,
    canRunPep: byScope.SANCTIONS.passed && byScope.FATF.passed,
    canGenerateDdr: byScope.SANCTIONS.passed && byScope.FATF.passed && byScope.PEP.passed,
  }
}
