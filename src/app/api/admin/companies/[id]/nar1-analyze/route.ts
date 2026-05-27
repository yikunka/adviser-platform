import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { extractPdfText } from '@/lib/company/pdf-utils'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_FILE_SIZE = 10 * 1024 * 1024

interface ExtractedInfo {
  directors: Array<{
    nameEn: string
    nameZh?: string
    dateOfAppointment?: string
    addressForService: string
    nationality?: string
    idType?: string
    idNumber?: string
    status: 'appointed' | 'resigned' | 'active'
    cessationDate?: string
  }>
  members: Array<{
    nameEn: string
    nameZh?: string
    address: string
    capacity: string
    telFax?: string
    becomingDate?: string
    cessationDate?: string
    status: 'active' | 'resigned'
  }>
  significantControllers: Array<{
    nameEn: string
    nameZh?: string
    entryDate?: string
    correspondenceAddress?: string
    natureOfControl: string
    becomingDate?: string
    cessationDate?: string
    isLegalEntity?: boolean
    legalEntityRegNo?: string
    issuingCountry?: string
  }>
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  try {
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, JPG, PNG allowed.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    // Read file content
    const bytes = Buffer.from(await file.arrayBuffer())
    const text = await extractPdfText(bytes)

    // Extract company info to check if we have existing records
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        directors: true,
        significantControllers: true,
      },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Use LLM to extract information
    const extractedInfo = await extractFromNar1(text, file.name)

    return NextResponse.json({
      success: true,
      data: extractedInfo,
      existingDirectorsCount: company.directors.length,
      existingSccCount: company.significantControllers.length,
    })
  } catch (error) {
    console.error('[nar1-analyze] Error:', error)
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    )
  }
}

async function extractFromNar1(text: string, fileName: string): Promise<ExtractedInfo> {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.BAILIAN_API_KEY || ''
  
  if (!apiKey) {
    throw new Error('API key not configured')
  }

  const prompt = `You are extracting Hong Kong Companies Ordinance annual return information from a NAR1 document.
  
Analyze the following NAR1 document text and extract all information about:

1. **Directors** (include both corporate service providers' appointed directors and changes):
   - nameEn: English name of the director
   - nameZh: Chinese name if available
   - dateOfAppointment: Date when they became director (YYYY-MM-DD format)
   - addressForService: Service address
   - nationality: Nationality if mentioned
   - idType: ID type if mentioned
   - idNumber: ID number if mentioned
   - status: "appointed" for newly appointed, "resigned" for resigned, "active" for continuing directors
   - cessationDate: When they ceased being director (if applicable)

2. **Members** (Shareholders/Members of the company):
   - nameEn: English name of the member
   - nameZh: Chinese name if available
   - address: Address of the member
   - capacity: Type of membership (e.g., "ordinary member", "holder of ordinary shares")
   - telFax: Contact number if available
   - becomingDate: Date they became a member
   - cessationDate: Date they ceased being member
   - status: "active" or "resigned"

3. **Significant Controllers** (persons with significant control over the company):
   - nameEn: English name
   - nameZh: Chinese name if available
   - entryDate: Date they became significant controller
   - correspondenceAddress: Correspondence address
   - natureOfControl: How they exercise control (must include one of: shares, voting rights, board appointment, right to dissolve)
   - becomingDate: When they became significant controller
   - cessationDate: When they ceased to be significant controller
   - isLegalEntity: true if it's a legal entity, false if individual
   - legalEntityRegNo: Registration number for legal entities
   - issuingCountry: Country of issuance (for individuals)

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "directors": [
    {
      "nameEn": "John Smith",
      "nameZh": "施约翰",
      "dateOfAppointment": "2023-01-01",
      "addressForService": "Suite 1234, 12/F, Tower A, Central Plaza, Hong Kong",
      "nationality": "Chinese",
      "idType": "HKID",
      "idNumber": "A123456(7)",
      "status": "appointed",
      "cessationDate": ""
    }
  ],
  "members": [
    {
      "nameEn": "ABC Holdings Limited",
      "nameZh": "ABC 控股有限公司",
      "address": "Room 100, 10th Floor, Building A, HK",
      "capacity": "holder of ordinary shares",
      "telFax": "+852-2345-6789",
      "becomingDate": "2023-01-01",
      "cessationDate": "",
      "status": "active"
    }
  ],
  "significantControllers": [
    {
      "nameEn": "ABC Holdings Limited",
      "nameZh": "ABC 控股有限公司",
      "entryDate": "2023-01-01",
      "correspondenceAddress": "Room 100, 10th Floor, Building A, HK",
      "natureOfControl": "controls more than 25% of shares through direct holding",
      "becomingDate": "2023-01-01",
      "cessationDate": "",
      "isLegalEntity": true,
      "legalEntityRegNo": "123456",
      "issuingCountry": ""
    }
  ]
}

Document information:
- File: ${fileName}
- Document content (truncated):
${text.slice(0, 15000)}

Important notes:
- If a director/member has been appointed AND resigned in this same filing, create separate entries with appropriate dates
- Status should reflect their current state: "active" for continuing persons
- For legal entities providing corporate services, set isLegalEntity=true
- Nature of control must be specific about how they control the company
- Extract ALL individuals/entities mentioned, not just those who changed
- Empty fields should be empty strings, not null
`

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen3.5-flash',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM API returned ${response.status}`)
  }

  const data = await response.json()
  const rawContent = data?.choices?.[0]?.message?.content
  
  if (!rawContent) {
    throw new Error('No response from LLM')
  }

  const parsed = extractJsonFromText(rawContent)
  
  return {
    directors: Array.isArray(parsed.directors) ? (parsed.directors as ExtractedInfo['directors']) : [],
    members: Array.isArray(parsed.members) ? (parsed.members as ExtractedInfo['members']) : [],
    significantControllers: Array.isArray(parsed.significantControllers)
      ? (parsed.significantControllers as ExtractedInfo['significantControllers'])
      : [],
  }
}

interface JsonParsableData {
  directors?: unknown[]
  members?: unknown[]
  significantControllers?: unknown[]
}

function extractJsonFromText(raw: string): JsonParsableData {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(trimmed) as JsonParsableData
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return { directors: [], members: [], significantControllers: [] }
    try {
      return JSON.parse(match[0]) as JsonParsableData
    } catch {
      return { directors: [], members: [], significantControllers: [] }
    }
  }
}
