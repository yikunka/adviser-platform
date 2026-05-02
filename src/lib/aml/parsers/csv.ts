import Papa from 'papaparse'
import type { AMLEntry, AMLAddress } from './xml'  // AMLAddress used in EU parser
import { normalizeGender } from './xml'

function euRowName(row: Record<string, string>): string {
  const whole = (row['Naal_wholename'] ?? '').trim()
  const first = (row['Naal_firstname'] ?? '').trim()
  const mid = (row['Naal_middlename'] ?? '').trim()
  const last = (row['Naal_lastname'] ?? '').trim()
  return whole || [first, mid, last].filter(Boolean).join(' ').trim()
}

// The EU CSV is denormalized: one row per attribute group (name, address, birth, ID, citizenship).
// A single sanctioned entity can have many rows sharing the same Entity_logical_id — the first
// row is the primary entry and subsequent name rows are aliases. DOB/nationality/ID/addresses are
// merged from whichever row carries them.
function parseEUCsvRows(rows: Record<string, string>[]): AMLEntry[] {
  type Group = {
    subjectType: string
    primaryRow: Record<string, string>
    primaryName: string
    aliases: string[]
    dob?: string
    nationality?: string
    gender?: string
    placeOfBirth?: string
    addresses: AMLAddress[]
    idNumbers: string[]
    listingReason?: string
    listingDate?: string
  }

  const groups = new Map<string, Group>()

  for (const row of rows) {
    // Entity_logical_id appears twice as a header; PapaParse renames the duplicate to _1.
    const entityId = (row['Entity_logical_id'] ?? row['EU_ref_num'] ?? '').toString().trim()
    if (!entityId) continue

    const st = (row['Subject_type'] ?? '').toUpperCase()
    const name = euRowName(row)
    const dob = (row['Birt_date'] ?? '').trim() || undefined
    const nat = (row['Citi_country'] ?? '').trim() || undefined
    const idn = (row['Iden_number'] ?? '').trim()
    const programme = (row['Programme'] ?? row['Entity_remark'] ?? '').trim() || undefined
    const gender = normalizeGender((row['Naal_gender'] ?? '').trim())

    // Place of birth: combine Birt_place + Birt_country
    const birtPlace = (row['Birt_place'] ?? '').trim()
    const birtCountry = (row['Birt_country'] ?? '').trim()
    const placeOfBirth = [birtPlace, birtCountry].filter(Boolean).join(', ') || undefined

    // Address from Addr_ fields on this row
    const addrStreet = (row['Addr_street'] ?? '').trim()
    const addrCity = (row['Addr_city'] ?? '').trim()
    const addrCountry = (row['Addr_country'] ?? '').trim()
    const addrZip = (row['Addr_zipcode'] ?? '').trim()
    const addrOther = (row['Addr_other'] ?? '').trim()
    const hasAddr = addrStreet || addrCity || addrCountry
    const addr: AMLAddress | null = hasAddr
      ? {
          street: addrStreet || addrOther || undefined,
          city: addrCity || undefined,
          country: addrCountry || undefined,
          postCode: addrZip || undefined,
        }
      : null

    // Listing date from regulation publication date (first non-empty, taken from the entity row)
    const listingDate = (row['Leba_publication_date'] ?? '').trim() || undefined

    if (!groups.has(entityId)) {
      groups.set(entityId, {
        subjectType: st,
        primaryRow: row,
        primaryName: name,
        aliases: [],
        dob,
        nationality: nat,
        gender,
        placeOfBirth,
        addresses: addr ? [addr] : [],
        idNumbers: idn ? [idn] : [],
        listingReason: programme,
        listingDate,
      })
    } else {
      const g = groups.get(entityId)!
      if (st && !g.subjectType) g.subjectType = st
      if (dob && !g.dob) g.dob = dob
      if (nat && !g.nationality) g.nationality = nat
      if (gender && !g.gender) g.gender = gender
      if (placeOfBirth && !g.placeOfBirth) g.placeOfBirth = placeOfBirth
      if (idn && !g.idNumbers.includes(idn)) g.idNumbers.push(idn)
      if (programme && !g.listingReason) g.listingReason = programme
      if (listingDate && !g.listingDate) g.listingDate = listingDate
      if (addr) {
        const alreadyExists = g.addresses.some(
          a => a.city === addr.city && a.country === addr.country && a.street === addr.street,
        )
        if (!alreadyExists) g.addresses.push(addr)
      }
      // Subsequent rows with a name are aliases of the primary entry
      if (name && name !== g.primaryName && !g.aliases.includes(name)) {
        g.aliases.push(name)
      }
    }
  }

  const entries: AMLEntry[] = []
  for (const g of groups.values()) {
    if (!g.primaryName) continue
    const isEntity = g.subjectType === 'E'
    entries.push({
      nameEn: g.primaryName,
      aliases: g.aliases,
      dateOfBirth: g.dob,
      nationality: g.nationality,
      gender: g.gender,
      placeOfBirth: g.placeOfBirth,
      addresses: g.addresses.length ? g.addresses : undefined,
      idNumbers: g.idNumbers,
      entityType: isEntity ? 'ENTITY' : 'INDIVIDUAL',
      listingReason: g.listingReason,
      listingDate: g.listingDate,
      rawData: g.primaryRow,
    })
  }
  return entries
}

export function parseCSV(content: string, sourceUrl: string): AMLEntry[] {
  if (sourceUrl.includes('ec.europa.eu') && content.includes('Subject_type')) {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
    })
    return parseEUCsvRows(result.data)
  }

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
  })
  const entries: AMLEntry[] = []

  for (const row of result.data) {
    // OpenSanctions targets.simple.csv (e.g. World Bank debarred mirror)
    const schema = (row['schema'] ?? '').toLowerCase()
    if (schema === 'legalentity' || schema === 'company' || schema === 'organization') {
      const nameEn = row['name'] ?? row['Name'] ?? ''
      if (!nameEn.trim()) continue
      entries.push({
        nameEn: nameEn.trim(),
        aliases: [],
        entityType: 'ENTITY',
        idNumbers: [],
        rawData: row,
      })
      continue
    }
    if (schema === 'person' || schema === 'individual') {
      const nameEn = row['name'] ?? row['Name'] ?? ''
      if (!nameEn.trim()) continue
      entries.push({
        nameEn: nameEn.trim(),
        aliases: [],
        entityType: 'INDIVIDUAL',
        idNumbers: [],
        rawData: row,
      })
      continue
    }

    // ICAC / generic fallback: columns vary by language version
    const nameEn =
      row['Name (English)'] ??
      row['Name'] ??
      row['name'] ??
      row['name_en'] ??
      row['Naal_wholename'] ??
      Object.values(row)[0] ??
      ''
    if (!nameEn.trim()) continue

    const rawAlias = (row['Alias'] ?? row['alias'] ?? '').trim()
    const aliases = rawAlias && rawAlias !== '-' && rawAlias !== '–' ? [rawAlias] : []
    const dob = (row['Date of Birth'] ?? row['date_of_birth'] ?? row['出生日期'] ?? '').trim() || undefined
    const nationality = (row['Nationality'] ?? row['nationality'] ?? row['國籍'] ?? '').trim() || undefined
    const gender = normalizeGender((row['Sex'] ?? row['sex'] ?? row['性別'] ?? '').trim())
    const placeOfBirth = (row['Place of Birth'] ?? row['place_of_birth'] ?? row['出生地點'] ?? '').trim() || undefined

    entries.push({
      nameEn: nameEn.trim(),
      aliases,
      dateOfBirth: dob,
      nationality,
      gender,
      placeOfBirth,
      entityType: 'INDIVIDUAL',
      idNumbers: [],
      rawData: row,
    })
  }

  return entries
}
