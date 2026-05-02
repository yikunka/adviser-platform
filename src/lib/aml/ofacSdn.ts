/**
 * OFAC SDN.XML is a very large file. Use a single long timeout and browser-like
 * headers. Shared by the CLI script and the AML ingester.
 */

export const OFAC_SDN_DEFAULT_URL =
  'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML'

export const OFAC_FETCH_TIMEOUT_MS = 25 * 60 * 1000

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
}

export function isOfacSdnList(source: {
  seqNo: number
  sourceUrl: string
  format: string
}): boolean {
  if (source.format !== 'XML') return false
  if (source.seqNo === 9) return true
  const u = source.sourceUrl.toLowerCase()
  return (
    (u.includes('ofac.treas.gov') || u.includes('sanctionslistservice')) &&
    u.includes('sdn') &&
    u.includes('xml')
  )
}

/**
 * Download full SDN.XML body into a Buffer (one long request; no chunk streaming).
 */
export async function fetchOfacSdnListBuffer(
  sourceUrl: string = OFAC_SDN_DEFAULT_URL,
): Promise<Buffer> {
  const url = process.env.OFAC_URL || sourceUrl
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(OFAC_FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`OFAC SDN: HTTP ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
