import { XMLParser } from 'fast-xml-parser'

export type AMLAddress = {
  street?: string
  city?: string
  country?: string
  postCode?: string
  note?: string
}

export type AMLEntry = {
  nameEn: string
  aliases: string[]
  dateOfBirth?: string
  nationality?: string
  gender?: string
  placeOfBirth?: string
  addresses?: AMLAddress[]
  idNumbers: string[]
  entityType: 'INDIVIDUAL' | 'ENTITY'
  listingReason?: string
  listingDate?: string  // ISO date string YYYY-MM-DD
  rawData: unknown
}

/** Normalize gender codes to "Male" / "Female". */
export function normalizeGender(val: unknown): string | undefined {
  if (!val) return undefined
  const v = String(val).trim().toLowerCase()
  if (v === 'm' || v === 'male' || v === '男' || v === '男性') return 'Male'
  if (v === 'f' || v === 'female' || v === '女' || v === '女性') return 'Female'
  const raw = String(val).trim()
  return raw || undefined
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function extractString(val: unknown): string {
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object' && '#text' in (val as object)) {
    return String((val as { '#text': unknown })['#text']).trim()
  }
  return ''
}

export function parseXML(content: string, sourceUrl: string): AMLEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_', parseAttributeValue: true })
  const data = parser.parse(content)

  // UN consolidated list
  if (sourceUrl.includes('scsanctions.un.org')) {
    return parseUNXML(data)
  }
  // HK Police wanted persons
  if (sourceUrl.includes('police.gov.hk')) {
    return parseHKPoliceXML(data)
  }
  // OFAC SDN
  if (sourceUrl.includes('ofac.treas.gov') || sourceUrl.includes('SDN.XML')) {
    return parseOFACXML(data)
  }
  // Canada
  if (sourceUrl.includes('international.gc.ca')) {
    return parseCanadaXML(data)
  }

  return []
}

function unNationality(n: unknown): string | undefined {
  if (!n) return undefined
  if (typeof n === 'object' && n !== null && 'VALUE' in (n as object)) {
    return extractString((n as Record<string, unknown>)['VALUE']) || undefined
  }
  return extractString(n) || undefined
}

function unDateOfBirth(dob: unknown): string | undefined {
  if (!dob || typeof dob !== 'object') return undefined
  const o = dob as Record<string, unknown>
  const y = extractString(o['YEAR'] ?? '')
  const m = extractString(o['MONTH'] ?? '')
  const d = extractString(o['DAY'] ?? '')
  if (y && m && d) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  if (y && m) return `${y}-${m.padStart(2, '0')}-01`
  if (y) return `${y}-01-01`
  return extractString(o['DATE'] ?? '') || undefined
}

function unIndividualAliases(i: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const block of toArray(i['INDIVIDUAL_ALIAS'] as unknown)) {
    const line = extractString((block as Record<string, unknown>)['ALIAS_NAME'] ?? '')
    if (line) out.push(line)
  }
  return out
}

function unEntityAliases(e: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const block of toArray(e['ENTITY_ALIAS'] as unknown)) {
    const line = extractString((block as Record<string, unknown>)['ALIAS_NAME'] ?? '')
    if (line) out.push(line)
  }
  return out
}

function unAddresses(rec: Record<string, unknown>, addrKey: string): AMLAddress[] {
  const out: AMLAddress[] = []
  for (const block of toArray(rec[addrKey] as unknown)) {
    const a = block as Record<string, unknown>
    const street = extractString(a['STREET'] ?? a['street'] ?? '') || undefined
    const city = extractString(a['CITY'] ?? a['city'] ?? '') || undefined
    const country = extractString(a['COUNTRY'] ?? a['country'] ?? '') || undefined
    const postCode = extractString(a['ZIP_CODE'] ?? a['zip_code'] ?? '') || undefined
    const note = extractString(a['NOTE'] ?? a['note'] ?? '') || undefined
    const stateProvince = extractString(a['STATE_PROVINCE'] ?? '') || undefined
    if (street || city || country || stateProvince) {
      out.push({ street: street ?? stateProvince, city, country, postCode, note })
    }
  }
  return out
}

function unPlaceOfBirth(pob: unknown): string | undefined {
  if (!pob) return undefined
  const o = pob as Record<string, unknown>
  const city = extractString(o['CITY'] ?? '') || undefined
  const state = extractString(o['STATE_PROVINCE'] ?? '') || undefined
  const country = extractString(o['COUNTRY'] ?? '') || undefined
  const parts = [city, state, country].filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

function parseUNXML(data: unknown): AMLEntry[] {
  const d = data as Record<string, unknown>
  const consolidated = (d['CONSOLIDATED_LIST'] ?? d['consolidated_list']) as Record<string, unknown> | undefined
  if (!consolidated) return []

  const entries: AMLEntry[] = []

  const indsRoot = (consolidated['INDIVIDUALS'] ?? consolidated['individuals']) as Record<string, unknown> | undefined
  const individuals = indsRoot?.['INDIVIDUAL'] ?? indsRoot?.['individual']

  for (const ind of toArray(individuals)) {
    const i = ind as Record<string, unknown>
    const firstNames = extractString(i['FIRST_NAME'] ?? i['first_name'] ?? '')
    const lastName = extractString(i['SECOND_NAME'] ?? i['THIRD_NAME'] ?? i['last_name'] ?? '')
    const nameEn = [firstNames, lastName].filter(Boolean).join(' ').trim() || 'UNKNOWN'

    const aliases = unIndividualAliases(i)
    const dobNode = toArray((i['INDIVIDUAL_DATE_OF_BIRTH'] ?? i['DOB'] ?? i['date_of_birth']) as unknown)[0]
    const addresses = unAddresses(i, 'INDIVIDUAL_ADDRESS')

    entries.push({
      nameEn,
      aliases,
      dateOfBirth: (unDateOfBirth(dobNode) ?? extractString(i['DOB'] ?? i['date_of_birth'] ?? '')) || undefined,
      nationality: unNationality(i['NATIONALITY']),
      gender: normalizeGender(extractString(i['GENDER'] ?? i['gender'] ?? '') || undefined),
      placeOfBirth: unPlaceOfBirth(toArray(i['INDIVIDUAL_PLACE_OF_BIRTH'] as unknown)[0]),
      addresses: addresses.length ? addresses : undefined,
      idNumbers: [],
      entityType: 'INDIVIDUAL',
      listingReason: extractString(i['COMMENTS1'] ?? i['reason'] ?? '') || undefined,
      listingDate: extractString(i['LISTED_ON'] ?? '') || undefined,
      rawData: i,
    })
  }

  const entsRoot = (consolidated['ENTITIES'] ?? consolidated['entities']) as Record<string, unknown> | undefined
  const entities = entsRoot?.['ENTITY'] ?? entsRoot?.['entity']

  for (const ent of toArray(entities)) {
    const e = ent as Record<string, unknown>
    const nameEn = extractString(e['FIRST_NAME'] ?? e['name'] ?? 'UNKNOWN')
    const addresses = unAddresses(e, 'ENTITY_ADDRESS')
    entries.push({
      nameEn,
      aliases: unEntityAliases(e),
      entityType: 'ENTITY',
      idNumbers: [],
      addresses: addresses.length ? addresses : undefined,
      listingReason: extractString(e['COMMENTS1'] ?? '') || undefined,
      listingDate: extractString(e['LISTED_ON'] ?? '') || undefined,
      rawData: e,
    })
  }

  return entries
}

function parseHKPoliceXML(data: unknown): AMLEntry[] {
  const d = data as Record<string, unknown>
  const bag =
    (d['wantedPersons'] as Record<string, unknown> | undefined) ??
    (d['otherRewardNotices'] as Record<string, unknown> | undefined) ??
    (d['persons'] as Record<string, unknown> | undefined) ??
    (d['notices'] as Record<string, unknown> | undefined) ??
    (d as Record<string, unknown>)

  const cases = toArray(bag['case'] as unknown)
  const entries: AMLEntry[] = []

  for (const c of cases) {
    const caseRec = c as Record<string, unknown>
    for (const it of toArray(caseRec['item'] as unknown)) {
      const i = it as Record<string, unknown>
      const nameEn = extractString(i['name_en'] ?? i['name'] ?? i['NAME'] ?? '')
      if (!nameEn) continue
      entries.push({
        nameEn,
        aliases: [],
        entityType: 'INDIVIDUAL',
        idNumbers: [],
        rawData: { case: caseRec, item: i },
      })
    }
  }

  return entries
}

function parseCanadaXML(data: unknown): AMLEntry[] {
  const d = data as Record<string, unknown>

  // Current consolidated list: <data-set><record>…
  const dataSet = (d['data-set'] ?? d['Data-Set'] ?? d['Data_Set']) as Record<string, unknown> | undefined
  if (dataSet) {
    const records = toArray(dataSet['record'] as unknown)
    return records.map(rec => {
      const i = rec as Record<string, unknown>
      const entityOrShip = extractString(i['EntityOrShip'] ?? '')
      const last = extractString(i['LastName'] ?? '')
      const given = extractString(i['GivenName'] ?? '')
      const nameEn =
        entityOrShip || [given, last].filter(Boolean).join(' ').trim() || 'UNKNOWN'
      const dob = extractString(i['DateOfBirthOrShipBuildDate'] ?? '') || undefined
      const listingDate = extractString(i['DateOfListing'] ?? '') || undefined
      return {
        nameEn,
        aliases: [],
        dateOfBirth: dob,
        listingDate,
        entityType: (entityOrShip ? 'ENTITY' : 'INDIVIDUAL') as 'ENTITY' | 'INDIVIDUAL',
        idNumbers: [],
        rawData: i,
      }
    })
  }

  // Legacy <schedule> shape
  const schedule = (d['schedule'] ?? d['Schedule'] ?? d) as Record<string, unknown>
  const items = toArray(schedule['entity'] ?? schedule['person'] as unknown)

  return items.map(item => {
    const i = item as Record<string, unknown>
    const nameEn = extractString(i['LastName'] ?? i['EntityName'] ?? i['name'] ?? 'UNKNOWN')
    return {
      nameEn,
      aliases: [],
      entityType: 'INDIVIDUAL' as const,
      idNumbers: [],
      rawData: i,
    }
  })
}

function parseOFACXML(data: unknown): AMLEntry[] {
  const d = data as Record<string, unknown>
  const root = d['sdnList'] as Record<string, unknown> | undefined
  if (!root) return []

  const out: AMLEntry[] = []
  for (const entry of toArray(root['sdnEntry'] as unknown)) {
    const e = entry as Record<string, unknown>
    const sdnType = extractString(e['sdnType'] ?? '').toLowerCase()
    const isEntity =
      sdnType === 'entity' ||
      (sdnType !== 'individual' && !extractString(e['firstName'] ?? ''))

    let nameEn: string
    if (isEntity) {
      nameEn = extractString(e['lastName'] ?? e['firstName'] ?? 'UNKNOWN')
    } else {
      const first = extractString(e['firstName'] ?? '')
      const last = extractString(e['lastName'] ?? '')
      nameEn = [first, last].filter(Boolean).join(' ').trim() || 'UNKNOWN'
    }

    const aliases: string[] = []
    const akaRoot = e['akaList'] as Record<string, unknown> | undefined
    for (const aka of toArray(akaRoot?.['aka'] as unknown)) {
      const a = aka as Record<string, unknown>
      if (isEntity) {
        const al = extractString(a['lastName'] ?? a['firstName'] ?? '')
        if (al) aliases.push(al)
      } else {
        const af = extractString(a['firstName'] ?? '')
        const al = extractString(a['lastName'] ?? '')
        const line = [af, al].filter(Boolean).join(' ').trim()
        if (line) aliases.push(line)
      }
    }

    let dateOfBirth: string | undefined
    const dobList = e['dateOfBirthList'] as Record<string, unknown> | undefined
    const dobItems = toArray(dobList?.['dateOfBirthItem'] as unknown)
    const mainDob = dobItems.find(
      x => String((x as Record<string, unknown>)['mainEntry']).toLowerCase() === 'true',
    ) ?? dobItems[0]
    if (mainDob) {
      dateOfBirth = extractString((mainDob as Record<string, unknown>)['dateOfBirth'] ?? '') || undefined
    }

    // Gender stored in idList as {idType: "Gender", idNumber: "Male"}
    let gender: string | undefined
    const idNumbers: string[] = []
    const idList = e['idList'] as Record<string, unknown> | undefined
    for (const id of toArray(idList?.['id'] as unknown)) {
      const idRec = id as Record<string, unknown>
      const idType = extractString(idRec['idType'] ?? '').toLowerCase()
      const idNumber = extractString(idRec['idNumber'] ?? '')
      if (idType === 'gender') {
        gender = normalizeGender(idNumber)
      } else if (idNumber) {
        idNumbers.push(idNumber)
      }
    }

    // Nationality from nationalityList (prefer mainEntry)
    let nationality: string | undefined
    const natList = e['nationalityList'] as Record<string, unknown> | undefined
    const natItems = toArray(natList?.['nationality'] as unknown)
    const mainNat = natItems.find(
      x => String((x as Record<string, unknown>)['mainEntry']).toLowerCase() === 'true',
    ) ?? natItems[0]
    if (mainNat) {
      nationality = extractString((mainNat as Record<string, unknown>)['country'] ?? '') || undefined
    }

    // Place of birth from placeOfBirthList (prefer mainEntry)
    let placeOfBirth: string | undefined
    const pobList = e['placeOfBirthList'] as Record<string, unknown> | undefined
    const pobItems = toArray(pobList?.['placeOfBirthItem'] as unknown)
    const mainPob = pobItems.find(
      x => String((x as Record<string, unknown>)['mainEntry']).toLowerCase() === 'true',
    ) ?? pobItems[0]
    if (mainPob) {
      placeOfBirth = extractString((mainPob as Record<string, unknown>)['placeOfBirth'] ?? '') || undefined
    }

    // Addresses from addressList
    const addresses: AMLAddress[] = []
    const addrList = e['addressList'] as Record<string, unknown> | undefined
    for (const addr of toArray(addrList?.['address'] as unknown)) {
      const a = addr as Record<string, unknown>
      const street = extractString(a['address1'] ?? a['address2'] ?? '') || undefined
      const city = extractString(a['city'] ?? '') || undefined
      const country = extractString(a['country'] ?? '') || undefined
      const postCode = extractString(a['postalCode'] ?? '') || undefined
      const stateOrProvince = extractString(a['stateOrProvince'] ?? '') || undefined
      if (street || city || country || stateOrProvince) {
        addresses.push({ street, city: city ?? stateOrProvince, country, postCode })
      }
    }

    // Listing reason from programList
    const programs = toArray((e['programList'] as Record<string, unknown> | undefined)?.['program'] as unknown)
      .map(p => extractString(p))
      .filter(Boolean)

    out.push({
      nameEn,
      aliases,
      dateOfBirth,
      nationality,
      gender,
      placeOfBirth,
      addresses: addresses.length ? addresses : undefined,
      idNumbers,
      entityType: isEntity ? 'ENTITY' : 'INDIVIDUAL',
      listingReason: programs.length ? programs.join(', ') : undefined,
      rawData: e,
    })
  }

  return out
}
