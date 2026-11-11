import { compareTwoStrings } from 'string-similarity'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import type { AMLCheckResult, AMLEntityType, AMLScreenScope, AMLSubjectType } from '@prisma/client'
import { runAdverseMediaScreen, shouldRunAdverseMedia } from './adverseMedia'
import { loadAllFatfJurisdictionEntries } from './fatfLists'
import {
  normalizeJurisdiction,
  scoreJurisdiction,
} from './fatfJurisdictionMatch'
import { matchOpenSanctionsPep } from './openSanctionsPep'

const STRONG_HIT_THRESHOLD = 0.98
const POTENTIAL_HIT_THRESHOLD = 0.92
const WEAK_HIT_THRESHOLD = 0.85

const FATF_SEQ = [14, 15]
/** OpenSanctions PEP source — also used to classify KYC step-3 alerts. */
export const OPENSANCTIONS_PEP_SEQ = 16

function normalize(name: string): string {
  return normalizeJurisdiction(name)
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

async function ensureFatfSource(seqNo: 14 | 15) {
  const meta =
    seqNo === 14
      ? {
          nameEn: 'FATF Black List (Call for Action)',
          nameZh: 'FATF 黑名單（呼籲採取行動）',
          sourceUrl: 'builtin:fatf-call-for-action',
        }
      : {
          nameEn: 'FATF Grey List (Increased Monitoring)',
          nameZh: 'FATF 灰名單（加強監控）',
          sourceUrl: 'builtin:fatf-increased-monitoring',
        }
  return prisma.aMLSource.upsert({
    where: { seqNo },
    update: { ...meta, format: 'JSON', isActive: true },
    create: { seqNo, ...meta, format: 'JSON', isActive: true },
  })
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

  // Same JSON the AML&PEP page displays — no DB ingest required
  const entries = loadAllFatfJurisdictionEntries()
  if (entries.length === 0) {
    throw new Error('FATF bundled lists are empty — update fatf-*.json')
  }

  const matches: MatchDetail[] = []
  let overallResult: AMLCheckResult = 'CLEAR'

  for (const entry of entries) {
    const targets = [entry.name, ...entry.aliases]
    let bestScore = 0
    for (const subject of jurisdictions) {
      const score = scoreJurisdiction(subject, targets)
      if (score > bestScore) bestScore = score
    }

    const hit = classify(bestScore)
    if (!hit) continue

    const source = await ensureFatfSource(entry.seqNo)
    const recordHash = createHash('sha256')
      .update(`fatf-json:${entry.seqNo}:${normalize(entry.name)}`)
      .digest('hex')
    const listingDate = entry.listingDate ? new Date(entry.listingDate) : null
    const record = await prisma.aMLRecord.upsert({
      where: { sourceId_recordHash: { sourceId: source.id, recordHash } },
      update: {
        primaryName: entry.name,
        aliases: entry.aliases,
        listingReason: entry.listingReason,
        listingDate: listingDate && !Number.isNaN(listingDate.getTime()) ? listingDate : undefined,
        rawData: entry as never,
      },
      create: {
        sourceId: source.id,
        listVersionDate: new Date(),
        entityType: 'ENTITY',
        primaryName: entry.name,
        aliases: entry.aliases,
        listingReason: entry.listingReason,
        listingDate: listingDate && !Number.isNaN(listingDate.getTime()) ? listingDate : undefined,
        recordHash,
        rawData: entry as never,
      },
    })

    matches.push({
      amlRecordId: record.id,
      primaryName: entry.name,
      score: bestScore,
      result: hit,
    })
    if (RESULT_RANK[hit] > RESULT_RANK[overallResult]) overallResult = hit
  }

  return { result: overallResult, matches }
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

  // Adverse media is a separate manual KYC step (no Google API required).
  // Do not auto-run Google CSE on FULL / submit for key persons.

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
  const scopes: Array<'SANCTIONS' | 'FATF' | 'PEP' | 'ADVERSE_MEDIA'> = [
    'SANCTIONS',
    'FATF',
    'PEP',
    'ADVERSE_MEDIA',
  ]
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
        const matchesObj =
          check?.matches
          && typeof check.matches === 'object'
          && !Array.isArray(check.matches)
            ? (check.matches as { skipped?: boolean; manualPass?: boolean; manual?: boolean })
            : null
        const skipped = Boolean(matchesObj?.skipped)
        return check
          ? {
              result: check.result,
              checkedAt: check.checkedAt,
              // Skipped (e.g. missing API key) must never unlock the next step / DDR
              passed: check.result === 'CLEAR' && !skipped,
              skipped,
              manualPass: Boolean(matchesObj?.manualPass || matchesObj?.manual),
            }
          : { result: null, checkedAt: null, passed: false, skipped: false, manualPass: false }
      })(),
    ]),
  ) as Record<
    'SANCTIONS' | 'FATF' | 'PEP' | 'ADVERSE_MEDIA',
    {
      result: AMLCheckResult | null
      checkedAt: Date | null
      passed: boolean
      skipped: boolean
      manualPass: boolean
    }
  >

  const pepReady = byScope.SANCTIONS.passed && byScope.FATF.passed
  return {
    sanctions: byScope.SANCTIONS,
    fatf: byScope.FATF,
    pep: byScope.PEP,
    adverseMedia: byScope.ADVERSE_MEDIA,
    canRunFatf: byScope.SANCTIONS.passed,
    canRunPep: pepReady,
    canRunAdverseMedia: pepReady && byScope.PEP.passed,
    canGenerateDdr:
      byScope.SANCTIONS.passed
      && byScope.FATF.passed
      && byScope.PEP.passed
      && byScope.ADVERSE_MEDIA.passed,
  }
}

/**
 * Staff override after explaining PEP hits: write a CLEAR PEP check and mark
 * open OpenSanctions PEP alerts as FALSE_POSITIVE so Adverse Media unlocks.
 */
export async function recordManualPepPass(
  keyPersonId: string,
  notes: string,
  triggeredById?: string,
): Promise<AMLCheckResult> {
  const trimmed = notes.trim()
  if (!trimmed) throw new Error('Explain why this PEP hit can be passed before continuing')

  const person = await prisma.keyPerson.findUnique({ where: { id: keyPersonId }, select: { id: true } })
  if (!person) throw new Error(`KeyPerson ${keyPersonId} not found`)

  const gate = await getKeyPersonScreenGate(keyPersonId)
  if (!gate.canRunPep) {
    throw new Error('Run AML and FATF first and get CLEAR before manually passing PEP')
  }
  if (gate.pep.passed) {
    throw new Error('PEP is already CLEAR')
  }
  if (!gate.pep.result) {
    throw new Error('Run PEP screening first before manually passing')
  }

  const now = new Date()
  await prisma.$transaction(async tx => {
    await tx.aMLCheck.create({
      data: {
        subjectType: 'KEY_PERSON',
        keyPersonId,
        trigger: 'MANUAL',
        triggeredById,
        result: 'CLEAR',
        scope: 'PEP',
        matches: {
          manualPass: true,
          notes: trimmed,
          priorResult: gate.pep.result,
        } as never,
      },
    })

    await tx.aMLAlert.updateMany({
      where: {
        keyPersonId,
        subjectType: 'KEY_PERSON',
        resolution: 'PENDING',
        amlRecord: { source: { seqNo: OPENSANCTIONS_PEP_SEQ } },
      },
      data: {
        resolution: 'FALSE_POSITIVE',
        reviewNotes: trimmed,
        reviewedById: triggeredById,
        reviewedAt: now,
        isActive: false,
      },
    })
  })

  return 'CLEAR'
}

/** Manual adverse-media step (staff reviewed news offline; supporting docs optional). */
export async function recordManualAdverseMedia(
  keyPersonId: string,
  outcome: 'CLEAR' | 'HIT',
  triggeredById?: string,
  notes?: string | null,
): Promise<AMLCheckResult> {
  const person = await prisma.keyPerson.findUnique({ where: { id: keyPersonId }, select: { id: true } })
  if (!person) throw new Error(`KeyPerson ${keyPersonId} not found`)

  const result: AMLCheckResult = outcome === 'CLEAR' ? 'CLEAR' : 'STRONG_HIT'
  await prisma.aMLCheck.create({
    data: {
      subjectType: 'KEY_PERSON',
      keyPersonId,
      trigger: 'MANUAL',
      triggeredById,
      result,
      scope: 'ADVERSE_MEDIA',
      matches: {
        manual: true,
        notes: notes?.trim() || null,
      } as never,
    },
  })
  return result
}
