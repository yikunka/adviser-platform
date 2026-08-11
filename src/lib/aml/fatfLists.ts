/**
 * FATF jurisdiction lists (Call for Action / Increased Monitoring).
 * FATF publishes HTML statements only (no machine-readable CSV/XML), and
 * fatf-gafi.org often blocks automated fetch. Bundled JSON is the ingest source;
 * update after each FATF plenary (typically Feb / Jun / Oct).
 */

import fs from 'fs'
import path from 'path'

export const FATF_CALL_FOR_ACTION_KEY = 'fatf-call-for-action'
export const FATF_INCREASED_MONITORING_KEY = 'fatf-increased-monitoring'

const BUILTIN_PREFIX = 'builtin:'

const FILE_BY_KEY: Record<string, string> = {
  [FATF_CALL_FOR_ACTION_KEY]: 'fatf-call-for-action.json',
  [FATF_INCREASED_MONITORING_KEY]: 'fatf-increased-monitoring.json',
}

const FILE_BY_SEQ: Record<number, string> = {
  14: FILE_BY_KEY[FATF_CALL_FOR_ACTION_KEY],
  15: FILE_BY_KEY[FATF_INCREASED_MONITORING_KEY],
}

export function isFatfBuiltinList(source: {
  seqNo: number
  sourceUrl: string
  format?: string
}): boolean {
  if (source.seqNo === 14 || source.seqNo === 15) return true
  const u = source.sourceUrl.trim().toLowerCase()
  if (u.startsWith(BUILTIN_PREFIX) && u.includes('fatf-')) return true
  return false
}

function resolveKey(source: { seqNo: number; sourceUrl: string }): string | null {
  if (FILE_BY_SEQ[source.seqNo]) {
    return source.seqNo === 14 ? FATF_CALL_FOR_ACTION_KEY : FATF_INCREASED_MONITORING_KEY
  }
  const u = source.sourceUrl.trim()
  if (u.toLowerCase().startsWith(BUILTIN_PREFIX)) {
    const key = u.slice(BUILTIN_PREFIX.length).trim()
    if (FILE_BY_KEY[key]) return key
  }
  return null
}

/** Load bundled FATF list JSON as a Buffer for the shared JSON parser. */
export function loadFatfListBuffer(source: {
  seqNo: number
  sourceUrl: string
}): Buffer {
  const key = resolveKey(source)
  const fileName = key ? FILE_BY_KEY[key] : FILE_BY_SEQ[source.seqNo]
  if (!fileName) {
    throw new Error(`Unknown FATF builtin list: seq=${source.seqNo} url=${source.sourceUrl}`)
  }
  const filePath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    'src',
    'lib',
    'aml',
    'data',
    fileName,
  )
  if (!fs.existsSync(filePath)) {
    throw new Error(`FATF list file missing: ${filePath}`)
  }
  return fs.readFileSync(filePath)
}
