import type { AMLEntry } from './xml'

function toStringArray(val: unknown): string[] {
  if (val == null) return []
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean)
  return String(val)
    .split(/[;|]/)
    .map(s => s.trim())
    .filter(Boolean)
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (!data || typeof data !== 'object') return []

  const d = data as Record<string, unknown>

  // World Bank JSON: { SANCTION_LIST: { VENDOR: [...] } }
  if (d['SANCTION_LIST']) {
    const sl = d['SANCTION_LIST'] as Record<string, unknown>
    const vendors = sl['VENDOR']
    return Array.isArray(vendors)
      ? (vendors as Record<string, unknown>[])
      : vendors
        ? [vendors as Record<string, unknown>]
        : []
  }

  // FATF / generic curated: { entries: [...] } or { jurisdictions: [...] }
  for (const key of ['entries', 'jurisdictions', 'items', 'VENDOR'] as const) {
    const v = d[key]
    if (Array.isArray(v)) return v as Record<string, unknown>[]
  }

  return []
}

export function parseJSON(content: string): AMLEntry[] {
  const data = JSON.parse(content) as unknown
  const items = extractItems(data)
  const entries: AMLEntry[] = []

  for (const item of items) {
    if (!item) continue
    const nameEn = String(item['VENDOR_NAME'] ?? item['name'] ?? item['NAME'] ?? '').trim()
    if (!nameEn) continue

    const aliases = toStringArray(item['aliases'] ?? item['ALIASES'] ?? item['alias'])
    const listingReason = item['listingReason'] ?? item['LISTING_REASON'] ?? item['reason']
    const listingDate = item['listingDate'] ?? item['LISTING_DATE'] ?? item['listed_at']

    entries.push({
      nameEn,
      aliases,
      entityType: 'ENTITY',
      idNumbers: [],
      listingReason: listingReason != null ? String(listingReason) : undefined,
      listingDate: listingDate != null ? String(listingDate) : undefined,
      rawData: item,
    })
  }
  return entries
}
