import * as XLSX from 'xlsx'
import type { AMLEntry, AMLAddress } from './xml'

/** Convert an Excel serial date number to an ISO date string (YYYY-MM-DD). */
function excelSerialToISO(serial: unknown): string | undefined {
  const n = Number(serial)
  if (!n || !isFinite(n)) return undefined
  // Excel epoch is Dec 30 1899; JS epoch is Jan 1 1970 → offset 25569 days
  const ms = Math.round((n - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

// Australia's consolidated list has one row per name variant (Primary Name / Alias / Original Script)
// linked by the Reference column. We group them to build proper primary + aliases structure.
function parseAustraliaXLSX(rows: Record<string, string>[]): AMLEntry[] {
  const groups = new Map<string, Record<string, string>[]>()
  for (const row of rows) {
    const raw = String(row['Reference'] ?? '').trim()
    if (!raw) continue
    // Primary rows have a plain numeric reference (e.g. "2"); alias/script rows append letters
    // (e.g. "2a", "3b"). Strip trailing letters to get the shared group key.
    const groupKey = raw.replace(/[a-zA-Z]+$/, '')
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey)!.push(row)
  }

  const entries: AMLEntry[] = []
  for (const groupRows of groups.values()) {
    const primaryRow = groupRows.find(r => (r['Name Type'] ?? '').toString().trim() === 'Primary Name')
    if (!primaryRow) continue

    const nameEn = String(primaryRow['Name of Individual or Entity'] ?? '').trim()
    if (!nameEn) continue

    const aliases = groupRows
      .filter(r => (r['Name Type'] ?? '').toString().trim() !== 'Primary Name')
      .map(r => String(r['Name of Individual or Entity'] ?? '').trim())
      .filter(Boolean)

    const typeCol = (primaryRow['Type'] ?? '').toString().toLowerCase()
    const entityType: 'INDIVIDUAL' | 'ENTITY' =
      typeCol.includes('entity') || typeCol.includes('vessel') || typeCol.includes('ship')
        ? 'ENTITY'
        : 'INDIVIDUAL'

    const dob = String(primaryRow['Date of Birth'] ?? '').trim() || undefined
    const nationality = String(primaryRow['Citizenship'] ?? '').trim() || undefined
    const placeOfBirth = String(primaryRow['Place of Birth'] ?? '').trim() || undefined
    const listingReason =
      String(primaryRow['Additional Information'] ?? primaryRow['Listing Information'] ?? '').trim() || undefined
    const imo = String(primaryRow['IMO Number'] ?? '').trim()

    // "Control Date" is stored as an Excel serial number
    const controlDateRaw = primaryRow['Control Date']
    const listingDate =
      controlDateRaw !== undefined && controlDateRaw !== ''
        ? excelSerialToISO(controlDateRaw)
        : undefined

    // "Address" is a free-text string; wrap it as a single address entry
    const addressStr = String(primaryRow['Address'] ?? '').trim()
    const addresses: AMLAddress[] = addressStr ? [{ street: addressStr }] : []

    entries.push({
      nameEn,
      aliases,
      entityType,
      dateOfBirth: dob,
      nationality,
      placeOfBirth,
      addresses: addresses.length ? addresses : undefined,
      listingReason,
      listingDate,
      idNumbers: imo ? [imo] : [],
      rawData: primaryRow,
    })
  }
  return entries
}

export function parseXLSX(buffer: Buffer): AMLEntry[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

  if (rows.length > 0 && 'Name Type' in rows[0] && 'Reference' in rows[0]) {
    return parseAustraliaXLSX(rows)
  }

  const entries: AMLEntry[] = []
  for (const row of rows) {
    const nameEn =
      row['Name of Individual or Entity'] ??
      row['Name of Individual/Entity'] ??
      row['Name'] ??
      row['name'] ??
      Object.values(row)[0] ??
      ''
    if (!nameEn.trim()) continue

    const typeCol = (row['Type'] ?? row['type'] ?? '').toString().toLowerCase()
    const entityType: 'INDIVIDUAL' | 'ENTITY' =
      typeCol.includes('entity') || typeCol.includes('vessel') || typeCol.includes('ship')
        ? 'ENTITY'
        : 'INDIVIDUAL'

    const listingReason =
      (row['Additional Information'] ?? row['Listing Information'] ?? '').toString().trim() || undefined
    const nationality = (row['Citizenship'] ?? row['citizenship'] ?? '').toString().trim() || undefined
    const dob = (row['Date of Birth'] ?? row['date of birth'] ?? '').toString().trim() || undefined
    const imo = (row['IMO Number'] ?? '').toString().trim()
    const idNumbers = imo ? [imo] : []

    entries.push({
      nameEn: nameEn.trim(),
      aliases: [],
      entityType,
      dateOfBirth: dob || undefined,
      nationality: nationality || undefined,
      listingReason,
      idNumbers,
      rawData: row,
    })
  }
  return entries
}
