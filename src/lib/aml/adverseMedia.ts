/**
 * Adverse media screening via Google Programmable Search (Custom Search JSON API).
 * Soft-fails when GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX are unset.
 * Baidu is intentionally out of scope for now.
 */

import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'
import type { AMLSubjectType } from '@prisma/client'

export type AdverseMediaCategory = 'CRIME' | 'PEP' | 'FINANCIAL_FRAUD'

export type AdverseMediaHit = {
  title: string
  snippet: string
  url: string
  publisher?: string
  query: string
  categories: AdverseMediaCategory[]
  relevanceScore: number
  rawData: unknown
}

const ADVERSE_EN =
  'crime OR criminal OR fraud OR "money laundering" OR corruption OR bribery OR arrested OR indictment OR scam OR embezzlement OR PEP OR "politically exposed" OR sanction'
const ADVERSE_ZH = '詐騙 OR 洗錢 OR 貪污 OR 犯罪 OR 被捕 OR 起訴 OR 欺詐 OR 舞弊 OR 政治公眾人物 OR 制裁'

const CATEGORY_RULES: Array<{ category: AdverseMediaCategory; patterns: RegExp[] }> = [
  {
    category: 'FINANCIAL_FRAUD',
    patterns: [
      /\bfraud\b/i,
      /\bscam\b/i,
      /embezzl/i,
      /money\s*launder/i,
      /ponzi/i,
      /證券欺詐|金融詐騙|詐騙|洗錢|舞弊|欺詐/,
    ],
  },
  {
    category: 'PEP',
    patterns: [
      /\bpep\b/i,
      /politically\s+exposed/i,
      /political\s+figure/i,
      /minister|senator|congressman|parliament/i,
      /政治公眾人物|政治人物|高官|部長|議員/,
    ],
  },
  {
    category: 'CRIME',
    patterns: [
      /\bcrime\b/i,
      /\bcriminal\b/i,
      /\barrest(ed)?\b/i,
      /\bindict(ed|ment)?\b/i,
      /\bconvict(ed|ion)?\b/i,
      /corruption|bribery|trafficking/i,
      /犯罪|被捕|起訴|貪污|賄賂|走私|判刑/,
    ],
  },
]

export function isAdverseMediaConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim())
}

export function shouldRunAdverseMedia(trigger: 'SCHEDULED' | 'MANUAL' | 'KYC_SUBMIT'): boolean {
  if (!isAdverseMediaConfigured()) return false
  if (trigger === 'SCHEDULED') return process.env.ADVERSE_MEDIA_ON_SCHEDULED === 'true'
  return true
}

function urlHash(url: string): string {
  return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex').slice(0, 32)
}

function classifyText(text: string): { categories: AdverseMediaCategory[]; relevanceScore: number } {
  const categories: AdverseMediaCategory[] = []
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(p => p.test(text))) categories.push(rule.category)
  }
  const relevanceScore = categories.length === 0 ? 0 : Math.min(1, 0.55 + categories.length * 0.15)
  return { categories, relevanceScore }
}

function buildQuery(name: string): string {
  const quoted = `"${name.replace(/"/g, '').trim()}"`
  // Prefer Chinese adverse keywords when the name itself is mostly CJK
  const cjkRatio = (name.match(/[\u4e00-\u9fff]/g)?.length ?? 0) / Math.max(name.length, 1)
  const adverse = cjkRatio > 0.3 ? ADVERSE_ZH : `${ADVERSE_EN} OR ${ADVERSE_ZH}`
  return `${quoted} (${adverse})`
}

type GoogleCseItem = {
  title?: string
  link?: string
  snippet?: string
  displayLink?: string
}

async function googleSearch(query: string, num = 5): Promise<GoogleCseItem[]> {
  const key = process.env.GOOGLE_CSE_API_KEY!.trim()
  const cx = process.env.GOOGLE_CSE_CX!.trim()
  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(Math.min(Math.max(num, 1), 10)))

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google CSE HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { items?: GoogleCseItem[] }
  return data.items ?? []
}

export async function searchAdverseMedia(names: string[]): Promise<AdverseMediaHit[]> {
  const uniqueNames = [...new Set(names.map(n => n.trim()).filter(Boolean))]
  if (uniqueNames.length === 0) return []

  const byUrl = new Map<string, AdverseMediaHit>()

  for (const name of uniqueNames) {
    const query = buildQuery(name)
    let items: GoogleCseItem[] = []
    try {
      items = await googleSearch(query, 5)
    } catch (err) {
      console.error(`[AdverseMedia] search failed for "${name}":`, (err as Error).message)
      continue
    }

    for (const item of items) {
      const title = (item.title ?? '').trim()
      const url = (item.link ?? '').trim()
      if (!title || !url) continue
      const snippet = (item.snippet ?? '').trim()
      const { categories, relevanceScore } = classifyText(`${title}\n${snippet}`)
      if (categories.length === 0) continue

      const existing = byUrl.get(url)
      if (existing) {
        const merged = new Set([...existing.categories, ...categories])
        existing.categories = [...merged]
        existing.relevanceScore = Math.max(existing.relevanceScore, relevanceScore)
        continue
      }

      byUrl.set(url, {
        title,
        snippet,
        url,
        publisher: item.displayLink,
        query,
        categories,
        relevanceScore,
        rawData: item,
      })
    }
  }

  return [...byUrl.values()].sort((a, b) => b.relevanceScore - a.relevanceScore)
}

export async function runAdverseMediaScreen(opts: {
  subjectType: AMLSubjectType
  keyPersonId?: string
  companyId?: string
  names: string[]
}): Promise<{ findingsCreated: number; findingsTotal: number; skippedReason?: string }> {
  if (!isAdverseMediaConfigured()) {
    return { findingsCreated: 0, findingsTotal: 0, skippedReason: 'not_configured' }
  }

  const subjectKey =
    opts.subjectType === 'KEY_PERSON'
      ? `kp:${opts.keyPersonId}`
      : `co:${opts.companyId}`

  if (!opts.keyPersonId && !opts.companyId) {
    return { findingsCreated: 0, findingsTotal: 0, skippedReason: 'no_subject' }
  }

  const hits = await searchAdverseMedia(opts.names)
  let created = 0

  for (const hit of hits) {
    const hash = urlHash(hit.url)
    const existing = await prisma.adverseMediaFinding.findUnique({
      where: { subjectKey_urlHash: { subjectKey, urlHash: hash } },
      select: { id: true },
    })
    if (existing) continue

    await prisma.adverseMediaFinding.create({
      data: {
        subjectType: opts.subjectType,
        subjectKey,
        keyPersonId: opts.keyPersonId,
        companyId: opts.companyId,
        query: hit.query,
        title: hit.title,
        snippet: hit.snippet || null,
        url: hit.url,
        urlHash: hash,
        publisher: hit.publisher,
        source: 'GOOGLE',
        categories: hit.categories,
        relevanceScore: hit.relevanceScore,
        rawData: hit.rawData as object,
      },
    })
    created++
  }

  const findingsTotal = await prisma.adverseMediaFinding.count({
    where:
      opts.subjectType === 'KEY_PERSON'
        ? { keyPersonId: opts.keyPersonId }
        : { companyId: opts.companyId },
  })

  return { findingsCreated: created, findingsTotal }
}

export type AdverseMediaFindingView = {
  id: string
  subjectType: AMLSubjectType
  keyPersonId: string | null
  companyId: string | null
  title: string
  snippet: string | null
  url: string
  publisher: string | null
  categories: string[]
  relevanceScore: number | null
  resolution: string
  createdAt: Date
}

export async function listAdverseMediaForSubjects(opts: {
  keyPersonIds?: string[]
  companyIds?: string[]
}): Promise<AdverseMediaFindingView[]> {
  const or: Array<{ keyPersonId?: { in: string[] }; companyId?: { in: string[] } }> = []
  if (opts.keyPersonIds?.length) or.push({ keyPersonId: { in: opts.keyPersonIds } })
  if (opts.companyIds?.length) or.push({ companyId: { in: opts.companyIds } })
  if (or.length === 0) return []

  return prisma.adverseMediaFinding.findMany({
    where: { OR: or, resolution: { not: 'FALSE_POSITIVE' } },
    orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      subjectType: true,
      keyPersonId: true,
      companyId: true,
      title: true,
      snippet: true,
      url: true,
      publisher: true,
      categories: true,
      relevanceScore: true,
      resolution: true,
      createdAt: true,
    },
  })
}
