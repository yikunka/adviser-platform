import type { AMLEntry } from './xml'

export function parseJSON(content: string): AMLEntry[] {
  const data = JSON.parse(content) as unknown
  const entries: AMLEntry[] = []

  // World Bank JSON: { SANCTION_LIST: { VENDOR: [...] } }
  let items: Record<string, unknown>[] = []
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (d['SANCTION_LIST']) {
      const sl = d['SANCTION_LIST'] as Record<string, unknown>
      const vendors = sl['VENDOR']
      items = Array.isArray(vendors) ? vendors as Record<string, unknown>[] : [vendors as Record<string, unknown>]
    } else if (Array.isArray(d)) {
      items = d as Record<string, unknown>[]
    }
  }

  for (const item of items) {
    if (!item) continue
    const nameEn = String(item['VENDOR_NAME'] ?? item['name'] ?? item['NAME'] ?? '')
    if (!nameEn.trim()) continue
    entries.push({
      nameEn: nameEn.trim(),
      aliases: [],
      entityType: 'ENTITY',
      idNumbers: [],
      rawData: item,
    })
  }
  return entries
}
