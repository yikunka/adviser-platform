export type KycImageAnalysisFields = {
  titlePrefix?: string
  nameEn?: string
  nameZh?: string
  idType?: string
  idNumber?: string
  placeOfIssue?: string
  placeOfBirth?: string
  idExpiry?: string
  dateOfBirth?: string
  nationality?: string
  homeAddress?: string
}

const KYC_IMAGE_MODEL = 'qwen3.5-flash'

export async function analyzeKycImage(file: File): Promise<KycImageAnalysisFields> {
  const apiKey = getBailianApiKey()
  if (!apiKey) return {}

  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'image/jpeg'

  const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: KYC_IMAGE_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Extract KYC identity information from this image.',
                'Return strict JSON only with this shape:',
                '{"titlePrefix":"","nameEn":"","nameZh":"","idType":"","idNumber":"","placeOfIssue":"","placeOfBirth":"","idExpiry":"YYYY-MM-DD","dateOfBirth":"YYYY-MM-DD","nationality":"","homeAddress":""}',
                'Use HKID, PASSPORT, or OTHER for idType where possible. Leave unknown fields as empty strings.',
              ].join('\n'),
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${bytes.toString('base64')}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  })

  if (!res.ok) {
    throw new Error(`Bailian API returned ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  return typeof raw === 'string' ? normalizeFields(parseJsonObject(raw)) : {}
}

function getBailianApiKey() {
  return (
    process.env['DASHSCOPE_API_KEY'] ??
    process.env['BAILIAN_API_KEY'] ??
    process.env['ALIYUN_BAILIAN_API_KEY'] ??
    ''
  ).trim()
}

function normalizeFields(value: unknown): KycImageAnalysisFields {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    titlePrefix: clean(record['titlePrefix']),
    nameEn: clean(record['nameEn']),
    nameZh: clean(record['nameZh']),
    idType: clean(record['idType'])?.toUpperCase(),
    idNumber: clean(record['idNumber']),
    placeOfIssue: clean(record['placeOfIssue']),
    placeOfBirth: clean(record['placeOfBirth']),
    idExpiry: normalizeDate(clean(record['idExpiry'])),
    dateOfBirth: normalizeDate(clean(record['dateOfBirth'])),
    nationality: clean(record['nationality']),
    homeAddress: clean(record['homeAddress']),
  }
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : undefined
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const raw = value.trim()
  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return undefined
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return {}
    try {
      return JSON.parse(match[0])
    } catch {
      return {}
    }
  }
}
