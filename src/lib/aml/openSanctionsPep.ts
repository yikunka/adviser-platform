/**
 * OpenSanctions Match API — PEP / RCA screening.
 * Docs: https://www.opensanctions.org/docs/api/matching/
 */

export type OpenSanctionsPepHit = {
  id: string
  caption: string
  score: number
  topics: string[]
  datasets: string[]
  aliases: string[]
  birthDate?: string | null
  nationality?: string | null
  raw: unknown
}

export type OpenSanctionsPepResult = {
  result: 'CLEAR' | 'WEAK_HIT' | 'POTENTIAL_HIT' | 'STRONG_HIT'
  hits: OpenSanctionsPepHit[]
  skipped?: boolean
  skipReason?: string
}

function getApiKey() {
  return (process.env['OPENSANCTIONS_API_KEY'] ?? '').trim()
}

function getDataset() {
  return (process.env['OPENSANCTIONS_PEP_DATASET'] ?? 'peps').trim() || 'peps'
}

function classifyScore(score: number): OpenSanctionsPepResult['result'] | null {
  if (score >= 0.85) return 'STRONG_HIT'
  if (score >= 0.7) return 'POTENTIAL_HIT'
  if (score >= 0.55) return 'WEAK_HIT'
  return null
}

const RANK: Record<OpenSanctionsPepResult['result'], number> = {
  CLEAR: 0,
  WEAK_HIT: 1,
  POTENTIAL_HIT: 2,
  STRONG_HIT: 3,
}

/**
 * Screen a person against OpenSanctions PEP collection via /match/{dataset}.
 * Soft-skips (CLEAR + skipped) when API key is unset.
 */
export async function matchOpenSanctionsPep(input: {
  names: string[]
  dateOfBirth?: Date | string | null
  nationality?: string | null
}): Promise<OpenSanctionsPepResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { result: 'CLEAR', hits: [], skipped: true, skipReason: 'OPENSANCTIONS_API_KEY not set' }
  }

  const names = input.names.map(n => n.trim()).filter(Boolean)
  if (names.length === 0) {
    return { result: 'CLEAR', hits: [] }
  }

  const birthDate =
    input.dateOfBirth instanceof Date
      ? input.dateOfBirth.toISOString().slice(0, 10)
      : typeof input.dateOfBirth === 'string' && input.dateOfBirth
        ? input.dateOfBirth.slice(0, 10)
        : undefined

  const properties: Record<string, string[]> = {
    name: names,
  }
  if (birthDate) properties.birthDate = [birthDate]
  if (input.nationality?.trim()) properties.nationality = [input.nationality.trim()]

  const dataset = getDataset()
  const url = `https://api.opensanctions.org/match/${encodeURIComponent(dataset)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      queries: {
        q1: {
          schema: 'Person',
          properties,
        },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenSanctions PEP match failed (${res.status}): ${text.slice(0, 400)}`)
  }

  const data = await res.json() as {
    responses?: {
      q1?: {
        results?: Array<{
          id?: string
          caption?: string
          score?: number
          datasets?: string[]
          properties?: Record<string, string[] | undefined>
          topics?: string[]
        }>
      }
    }
  }

  const rawResults = data.responses?.q1?.results ?? []
  const hits: OpenSanctionsPepHit[] = []
  let overall: OpenSanctionsPepResult['result'] = 'CLEAR'

  for (const row of rawResults) {
    const score = typeof row.score === 'number' ? row.score : 0
    const classified = classifyScore(score)
    if (!classified) continue

    const props = row.properties ?? {}
    const topics = Array.isArray(row.topics)
      ? row.topics
      : Array.isArray(props.topics)
        ? props.topics
        : []

    // Prefer PEP / RCA topics when present; still keep high scores from peps dataset
    const isPepTopic =
      topics.some(t => /pep|rca|politic/i.test(t))
      || dataset.toLowerCase().includes('pep')

    if (!isPepTopic && score < 0.7) continue

    hits.push({
      id: row.id ?? `os-${hits.length}`,
      caption: row.caption ?? props.name?.[0] ?? 'Unknown',
      score,
      topics,
      datasets: row.datasets ?? [],
      aliases: (props.alias ?? props.weakAlias ?? []).filter(Boolean),
      birthDate: props.birthDate?.[0] ?? null,
      nationality: props.nationality?.[0] ?? null,
      raw: row,
    })

    if (RANK[classified] > RANK[overall]) overall = classified
  }

  return { result: overall, hits }
}
