import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { readFileBuffer } from '@/lib/storage/r2'
import { analyzeKycDocument } from '@/lib/kyc/image-analysis'
import { mergeDocumentAnalyses, type KycFullAnalysisFields } from '@/lib/kyc/kyc-full-analysis'
import { keyPersonToFormValues } from '@/lib/kyc/personZod'

const ANALYZE_TYPES = ['KYC_ID', 'KYC_ADDRESS', 'KYC_DECLARATION'] as const
type AnalyzeType = (typeof ANALYZE_TYPES)[number]

function pickLatestByType(
  docs: Array<{
    id: string
    documentType: string
    fileName: string
    storageKey: string
    mimeType: string
    status: string
    uploadedAt: Date
  }>,
  type: AnalyzeType,
) {
  return docs
    .filter(d => d.documentType === type && d.status !== 'REJECTED')
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0]
}

async function analyzeStoredDoc(
  doc: { fileName: string; storageKey: string; mimeType: string } | undefined,
  role: AnalyzeType,
): Promise<{ fields: KycFullAnalysisFields; error?: string } | null> {
  if (!doc) return null
  try {
    const buffer = await readFileBuffer(doc.storageKey)
    const mime = doc.mimeType || 'application/octet-stream'
    if (!mime.startsWith('image/') && mime !== 'application/pdf') {
      return { fields: {}, error: `Unsupported mime type for ${role}: ${mime}` }
    }
    const file = new File([new Uint8Array(buffer)], doc.fileName, { type: mime })
    const fields = await analyzeKycDocument(file, role)
    return { fields }
  } catch (err) {
    console.error(`[kyc/analyze] ${role} failed:`, err)
    return { fields: {}, error: err instanceof Error ? err.message : 'Analysis failed' }
  }
}

/**
 * POST /api/admin/kyc/[id]/analyze
 * Analyzes latest KYC_ID + KYC_ADDRESS + KYC_DECLARATION and returns a draft
 * (does not write to DB — client must confirm via PATCH).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const { id } = await params
  const record = await prisma.keyPerson.findUnique({
    where: { id },
    include: {
      kycDocuments: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          storageKey: true,
          mimeType: true,
          status: true,
          uploadedAt: true,
        },
      },
    },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const idDoc = pickLatestByType(record.kycDocuments, 'KYC_ID')
  const addressDoc = pickLatestByType(record.kycDocuments, 'KYC_ADDRESS')
  const declarationDoc = pickLatestByType(record.kycDocuments, 'KYC_DECLARATION')

  if (!idDoc && !addressDoc && !declarationDoc) {
    return NextResponse.json(
      { error: 'Upload KYC_ID, KYC_ADDRESS, and/or KYC_DECLARATION before analyzing' },
      { status: 400 },
    )
  }

  const [idResult, addressResult, declarationResult] = await Promise.all([
    analyzeStoredDoc(idDoc, 'KYC_ID'),
    analyzeStoredDoc(addressDoc, 'KYC_ADDRESS'),
    analyzeStoredDoc(declarationDoc, 'KYC_DECLARATION'),
  ])

  const base = keyPersonToFormValues(record)
  const draft = mergeDocumentAnalyses({
    base,
    id: idResult?.fields,
    address: addressResult?.fields,
    declaration: declarationResult?.fields,
  })

  return NextResponse.json({
    draft,
    sources: {
      KYC_ID: idDoc ? { id: idDoc.id, fileName: idDoc.fileName, error: idResult?.error ?? null } : null,
      KYC_ADDRESS: addressDoc
        ? { id: addressDoc.id, fileName: addressDoc.fileName, error: addressResult?.error ?? null }
        : null,
      KYC_DECLARATION: declarationDoc
        ? { id: declarationDoc.id, fileName: declarationDoc.fileName, error: declarationResult?.error ?? null }
        : null,
    },
  })
}
