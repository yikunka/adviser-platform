import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import { analyzeKycDocument } from '@/lib/kyc/image-analysis'
import { nextKycCode } from '@/lib/kyc/kyc-code'
import { logAudit } from '@/lib/audit/logger'
import crypto from 'crypto'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MAX_SIZE = 10 * 1024 * 1024

function splitEnglishName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const clientUserId = String(formData.get('clientUserId') ?? '').trim()

  if (!clientUserId) return NextResponse.json({ error: 'clientRequired' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, and PDF files are allowed.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
  }

  const client = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Invalid client account' }, { status: 400 })

  let fields
  try {
    fields = await analyzeKycDocument(file)
  } catch (err) {
    console.error('[admin/kyc/image-create] Bailian analysis failed:', err)
    return NextResponse.json({ error: 'Image analysis failed' }, { status: 502 })
  }

  if (!fields.nameEn) {
    return NextResponse.json({ error: 'Could not extract English name from image' }, { status: 422 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
  const key = `kyc/${clientUserId}/${crypto.randomUUID()}.${ext}`

  try {
    await uploadToR2(key, bytes, file.type)
  } catch (err) {
    console.error('[admin/kyc/image-create] OSS PutObject failed:', err)
    return NextResponse.json({ error: 'Could not store file.' }, { status: 503 })
  }

  const now = new Date()
  const nameParts = splitEnglishName(fields.nameEn)
  const created = await prisma.keyPerson.create({
    data: {
      kycCode: await nextKycCode(),
      titlePrefix: fields.titlePrefix,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      nameEn: fields.nameEn,
      nameZh: fields.nameZh,
      idType: fields.idType,
      idNumber: fields.idNumber,
      placeOfIssue: fields.placeOfIssue,
      placeOfBirth: fields.placeOfBirth,
      idExpiryDate: fields.idExpiry ? new Date(fields.idExpiry) : undefined,
      dateOfBirth: fields.dateOfBirth ? new Date(fields.dateOfBirth) : undefined,
      nationality: fields.nationality,
      homeAddress: fields.homeAddress,
      submittedByUserId: clientUserId,
      kycStatus: 'APPROVED',
      kycApprovedById: session!.user.id,
      kycApprovedAt: now,
      declarationSigned: true,
      declarationDate: now,
      kycDocuments: {
        create: {
          documentType: fields.idType || 'IDENTITY',
          fileName: file.name,
          storageKey: key,
          mimeType: file.type,
          fileSize: file.size,
          status: 'APPROVED',
          verifiedAt: now,
        },
      },
    },
    include: {
      kycDocuments: {
        select: {
          id: true,
          fileName: true,
          documentType: true,
          storageKey: true,
          mimeType: true,
          fileSize: true,
          status: true,
          uploadedAt: true,
        },
      },
      submittedByUser: { select: { email: true, nameEn: true } },
      companyLinks: {
        include: {
          company: {
            select: {
              nameEn: true,
              clientUser: { select: { email: true, nameEn: true } },
            },
          },
        },
      },
    },
  })

  await logAudit(session!.user.id, 'CREATE_APPROVED_KYC', 'KeyPerson', created.id, null, created)
  return NextResponse.json({ record: created }, { status: 201 })
}
