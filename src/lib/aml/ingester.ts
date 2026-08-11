import { prisma } from '@/lib/db/prisma'
import { parseXML } from './parsers/xml'
import { parseCSV } from './parsers/csv'
import { parseXLSX } from './parsers/xlsx'
import { parseJSON } from './parsers/json'
import type { AMLEntry } from './parsers/xml'
import { fetchOfacSdnListBuffer, isOfacSdnList } from './ofacSdn'
import { isFatfBuiltinList, loadFatfListBuffer } from './fatfLists'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const RETRY_DELAYS = [2000, 5000, 10000]
const DOWNLOAD_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'aml-downloads')
const KEEP_DAYS = 2

const FORMAT_EXT: Record<string, string> = { XML: 'xml', CSV: 'csv', XLSX: 'xlsx', JSON: 'json' }

/** Some government CDNs return 403/empty to generic clients; match a normal browser. */
const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function saveAndClean(buffer: Buffer, seqNo: number, format: string): string {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
  const ext = FORMAT_EXT[format] ?? 'bin'
  const today = todayStr()
  const filePath = path.join(DOWNLOAD_DIR, `${seqNo}_${today}.${ext}`)

  // Overwrite today's file (handles multiple fetches in one day)
  fs.writeFileSync(filePath, buffer)

  // Delete this source's files older than KEEP_DAYS
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS)
  const prefix = `${seqNo}_`
  for (const name of fs.readdirSync(DOWNLOAD_DIR)) {
    if (!name.startsWith(prefix)) continue
    const dateStr = name.slice(prefix.length, prefix.length + 10) // YYYY-MM-DD
    if (dateStr < cutoff.toISOString().slice(0, 10)) {
      fs.unlinkSync(path.join(DOWNLOAD_DIR, name))
      console.log(`[AML] Deleted old file: ${name}`)
    }
  }

  return filePath
}

function fetchTimeoutMs(url: string): number {
  const u = url.toLowerCase()
  // OFAC SDN.XML is very large (often 30–100MB+). Download + arrayBuffer() must complete within this window.
  if (
    u.includes('ofac.treas.gov') ||
    u.includes('sanctionslistservice') ||
    (u.includes('/sdn.xml') && u.includes('ofac'))
  ) {
    return 25 * 60 * 1000 // 25 minutes
  }
  return 120_000
}

async function fetchWithRetry(url: string): Promise<Buffer> {
  let lastError: Error | null = null
  const timeout = fetchTimeoutMs(url)
  for (let i = 0; i <= RETRY_DELAYS.length; i++) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(timeout),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      lastError = err as Error
      if (i < RETRY_DELAYS.length) await new Promise(r => setTimeout(r, RETRY_DELAYS[i]))
    }
  }
  throw lastError ?? new Error('Failed to fetch')
}

/**
 * One row in DB = one `recordHash`. Default is name-based; for UN (and similar) the same
 * display name can appear on multiple list entries, so we prefer stable IDs from `rawData`.
 */
function recordStableKey(e: AMLEntry): string {
  const r = e.rawData
  if (r && typeof r === 'object' && r !== null) {
    const o = r as Record<string, unknown>
    const unId = o['DATAID'] ?? o['dataid']
    if (unId != null && String(unId).trim() !== '') {
      return `un:${String(unId).trim()}`
    }
  }
  return e.nameEn
}

function recordHash(sourceId: string, stableKey: string): string {
  return crypto.createHash('sha256').update(`${sourceId}::${stableKey.toLowerCase()}`).digest('hex')
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

async function upsertEntriesForSource(
  source: { id: string; seqNo: number },
  entries: AMLEntry[],
): Promise<number> {
  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100)
    await Promise.all(
      batch.map(e => {
        const key = recordStableKey(e)
        const h = recordHash(source.id, key)
        return prisma.aMLRecord.upsert({
          where: { sourceId_recordHash: { sourceId: source.id, recordHash: h } },
          create: {
            sourceId: source.id,
            recordHash: h,
            primaryName: e.nameEn,
            aliases: e.aliases,
            listVersionDate: new Date(),
            dateOfBirth: parseOptionalDate(e.dateOfBirth),
            nationality: e.nationality,
            gender: e.gender,
            placeOfBirth: e.placeOfBirth,
            addresses: e.addresses?.length ? (e.addresses as never) : undefined,
            entityType: e.entityType,
            listingReason: e.listingReason,
            listingDate: parseOptionalDate(e.listingDate),
            idNumbers: e.idNumbers?.length ? (e.idNumbers as never) : undefined,
            rawData: e.rawData as never,
          },
          update: {
            primaryName: e.nameEn,
            aliases: e.aliases,
            listVersionDate: new Date(),
            dateOfBirth: parseOptionalDate(e.dateOfBirth) ?? null,
            nationality: e.nationality ?? null,
            gender: e.gender ?? null,
            placeOfBirth: e.placeOfBirth ?? null,
            // JSON fields use Prisma.JsonNull to clear; omit (undefined) when empty to preserve existing
            addresses: e.addresses?.length ? (e.addresses as never) : undefined,
            entityType: e.entityType,
            listingReason: e.listingReason ?? null,
            listingDate: parseOptionalDate(e.listingDate) ?? null,
            idNumbers: e.idNumbers?.length ? (e.idNumbers as never) : undefined,
            rawData: e.rawData as never,
            updatedAt: new Date(),
          },
        })
      }),
    )
  }
  return entries.length
}

function parseBufferToEntries(
  buffer: Buffer,
  source: { format: string; sourceUrl: string },
): AMLEntry[] {
  switch (source.format) {
    case 'XML':
      return parseXML(buffer.toString('utf-8'), source.sourceUrl)
    case 'CSV':
      return parseCSV(buffer.toString('utf-8'), source.sourceUrl)
    case 'XLSX':
      return parseXLSX(buffer)
    case 'JSON':
      return parseJSON(buffer.toString('utf-8'))
    default:
      return []
  }
}

export type SourceIngestResult = {
  seqNo: number
  nameEn: string
  status: 'ok' | 'error' | 'skipped'
  skippedReason?: 'already_upserted' | 'file_reused' | 'no_local_file'
  upserted: number
  totalInDb: number
  fetchedAt: string | null
  savedFile: string | null
  error?: string
}

async function ingestSource(source: {
  id: string
  seqNo: number
  sourceUrl: string
  format: string
  nameEn: string
  lastFetched: Date | null
}): Promise<{ upserted: number; savedFile: string; skippedReason?: 'already_upserted' | 'file_reused' }> {
  const ext = FORMAT_EXT[source.format] ?? 'bin'
  const today = todayStr()
  const filePath = path.join(DOWNLOAD_DIR, `${source.seqNo}_${today}.${ext}`)
  const alreadyUpsertedToday = source.lastFetched?.toISOString().slice(0, 10) === today
  const fileExists = fs.existsSync(filePath)

  // Skip only when both conditions hold: data upserted today AND file still on disk
  if (alreadyUpsertedToday && fileExists) {
    console.log(`[AML] Source ${source.seqNo}: already upserted today, skipping`)
    return { upserted: 0, savedFile: filePath, skippedReason: 'already_upserted' }
  }

  // Decide whether to download or reuse today's file on disk
  let buffer: Buffer
  let skippedReason: 'file_reused' | undefined

  if (fileExists) {
    console.log(`[AML] Source ${source.seqNo}: file already downloaded today, reusing ${filePath}`)
    buffer = fs.readFileSync(filePath)
    skippedReason = 'file_reused'
  } else {
    if (isFatfBuiltinList(source)) {
      console.log(
        `[AML] Source ${source.seqNo}: FATF jurisdiction list — loading bundled JSON → ${source.nameEn}`,
      )
      buffer = loadFatfListBuffer(source)
    } else if (isOfacSdnList(source)) {
      console.log(
        `[AML] Source ${source.seqNo}: OFAC SDN — dedicated long download (≈25m max) → ${source.nameEn}`,
      )
      buffer = await fetchOfacSdnListBuffer(source.sourceUrl)
    } else {
      console.log(`[AML] Source ${source.seqNo}: downloading ${source.nameEn}`)
      buffer = await fetchWithRetry(source.sourceUrl)
    }
    saveAndClean(buffer, source.seqNo, source.format)
  }

  const entries = parseBufferToEntries(buffer, source)
  console.log(`[AML] Source ${source.seqNo}: parsed ${entries.length} entries`)

  const upserted = await upsertEntriesForSource(source, entries)

  await prisma.aMLSource.update({
    where: { id: source.id },
    data: { lastFetched: new Date() },
  })

  console.log(`[AML] Source ${source.seqNo}: upserted ${upserted} records`)
  return { upserted, savedFile: filePath, skippedReason }
}

export type IngestProgressEvent =
  | { type: 'start';  seqNo: number; nameEn: string }
  | { type: 'result'; result: SourceIngestResult }

export async function ingestAllSources(
  onProgress?: (event: IngestProgressEvent) => void,
): Promise<{ total: number; errors: string[]; sources: SourceIngestResult[] }> {
  const sources = await prisma.aMLSource.findMany({ orderBy: { seqNo: 'asc' } })
  let total = 0
  const errors: string[] = []
  const sourceResults: SourceIngestResult[] = []

  for (const source of sources) {
    onProgress?.({ type: 'start', seqNo: source.seqNo, nameEn: source.nameEn })
    try {
      const { upserted, savedFile, skippedReason } = await ingestSource(source)
      total += upserted
      const updatedSource = await prisma.aMLSource.findUnique({ where: { id: source.id } })
      const totalInDb = await prisma.aMLRecord.count({ where: { sourceId: source.id } })
      const result: SourceIngestResult = {
        seqNo: source.seqNo,
        nameEn: source.nameEn,
        status: skippedReason ? 'skipped' : 'ok',
        skippedReason,
        upserted,
        totalInDb,
        fetchedAt: updatedSource?.lastFetched?.toISOString() ?? null,
        savedFile,
      }
      sourceResults.push(result)
      onProgress?.({ type: 'result', result })
    } catch (err) {
      const e = err as Error
      const msg = `Source ${source.seqNo} (${source.nameEn}): ${e.message}`
      errors.push(msg)
      console.error(`[AML] ${msg}`)
      if (e.stack) console.error(e.stack)
      const totalInDb = await prisma.aMLRecord.count({ where: { sourceId: source.id } }).catch(() => 0)
      const result: SourceIngestResult = {
        seqNo: source.seqNo,
        nameEn: source.nameEn,
        status: 'error',
        upserted: 0,
        totalInDb,
        fetchedAt: null,
        savedFile: null,
        error: (err as Error).message,
      }
      sourceResults.push(result)
      onProgress?.({ type: 'result', result })
    }
  }

  return { total, errors, sources: sourceResults }
}

/**
 * Parse today’s files already in `aml-downloads` (no network download) and upsert into DB.
 * Sources without `${seqNo}_${today}.{ext}` are skipped with `no_local_file`.
 */
export async function ingestAllSourcesFromLocalFiles(
  onProgress?: (event: IngestProgressEvent) => void,
): Promise<{ total: number; errors: string[]; sources: SourceIngestResult[] }> {
  const sources = await prisma.aMLSource.findMany({ orderBy: { seqNo: 'asc' } })
  let total = 0
  const errors: string[] = []
  const sourceResults: SourceIngestResult[] = []

  for (const source of sources) {
    onProgress?.({ type: 'start', seqNo: source.seqNo, nameEn: source.nameEn })
    try {
      const { upserted, savedFile, skippedReason } = await ingestSourceFromLocalFileOnly(source)
      total += upserted
      const updated = await prisma.aMLSource.findUnique({ where: { id: source.id } })
      const totalInDb = await prisma.aMLRecord.count({ where: { sourceId: source.id } })
      const result: SourceIngestResult = {
        seqNo: source.seqNo,
        nameEn: source.nameEn,
        status: skippedReason ? 'skipped' : 'ok',
        skippedReason,
        upserted,
        totalInDb,
        fetchedAt: updated?.lastFetched?.toISOString() ?? null,
        savedFile,
      }
      sourceResults.push(result)
      onProgress?.({ type: 'result', result })
    } catch (err) {
      const e = err as Error
      const msg = `Source ${source.seqNo} (${source.nameEn}): ${e.message}`
      errors.push(msg)
      console.error(`[AML] ${msg}`)
      if (e.stack) console.error(e.stack)
      const totalInDb = await prisma.aMLRecord.count({ where: { sourceId: source.id } }).catch(() => 0)
      const result: SourceIngestResult = {
        seqNo: source.seqNo,
        nameEn: source.nameEn,
        status: 'error',
        upserted: 0,
        totalInDb,
        fetchedAt: null,
        savedFile: null,
        error: (err as Error).message,
      }
      sourceResults.push(result)
      onProgress?.({ type: 'result', result })
    }
  }

  return { total, errors, sources: sourceResults }
}

async function ingestSourceFromLocalFileOnly(source: {
  id: string
  seqNo: number
  sourceUrl: string
  format: string
  nameEn: string
}): Promise<{ upserted: number; savedFile: string | null; skippedReason?: 'no_local_file' }> {
  const ext = FORMAT_EXT[source.format] ?? 'bin'
  const filePath = path.join(DOWNLOAD_DIR, `${source.seqNo}_${todayStr()}.${ext}`)

  let buffer: Buffer | null = null
  let savedFile: string | null = filePath

  if (fs.existsSync(filePath)) {
    buffer = fs.readFileSync(filePath)
  } else if (isFatfBuiltinList(source)) {
    // FATF has no remote download — fall back to bundled JSON for local extract too
    console.log(`[AML] Source ${source.seqNo}: no local file; loading bundled FATF JSON`)
    buffer = loadFatfListBuffer(source)
    savedFile = saveAndClean(buffer, source.seqNo, source.format)
  } else {
    console.log(`[AML] Source ${source.seqNo}: no local file for today (${filePath})`)
    return { upserted: 0, savedFile: null, skippedReason: 'no_local_file' }
  }

  const entries = parseBufferToEntries(buffer, source)
  console.log(`[AML] Local extract ${source.seqNo}: parsed ${entries.length} entries from ${savedFile}`)

  const upserted = await upsertEntriesForSource(source, entries)

  await prisma.aMLSource.update({
    where: { id: source.id },
    data: { lastFetched: new Date() },
  })

  console.log(`[AML] Local extract ${source.seqNo}: upserted ${upserted} records`)
  return { upserted, savedFile }
}
