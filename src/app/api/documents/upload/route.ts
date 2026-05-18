import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { uploadToR2 } from '@/lib/storage/r2'
import crypto from 'crypto'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const STAFF_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const docType = (formData.get('type') as string) ?? 'KYC'
  const companyId = formData.get('companyId') as string | null
  const keyPersonId = formData.get('keyPersonId') as string | null
  const notes = formData.get('notes') as string | null
  const effectiveDate = formData.get('effectiveDate') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Only PDF, JPG, PNG allowed.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
  }
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { clientUserId: true },
    })
    if (!company) return NextResponse.json({ error: 'Invalid company' }, { status: 404 })
    if (!STAFF_ROLES.has(session.user.role) && company.clientUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : 'png'
  const key = `documents/${session.user.id}/${crypto.randomUUID()}.${ext}`

  try {
    await uploadToR2(key, buffer, file.type)
  } catch (err) {
    console.error('[documents/upload] OSS PutObject failed:', err)
    return NextResponse.json(
      { error: 'Could not store file. Verify OSS credentials and bucket configuration.' },
      { status: 503 },
    )
  }

  if (keyPersonId) {
    const kp = await prisma.keyPerson.findFirst({
      where: { id: keyPersonId, submittedByUserId: session.user.id },
    })
    if (!kp) {
      return NextResponse.json({ error: 'Invalid key person' }, { status: 403 })
    }
    const kycDoc = await prisma.kYCDocument.create({
      data: {
        keyPersonId,
        documentType: docType,
        fileName: file.name,
        storageKey: key,
        mimeType: file.type,
        fileSize: file.size,
      },
    })
    return NextResponse.json(
      { documentId: kycDoc.id, name: file.name, kind: 'kyc' },
      { status: 201 }
    )
  }

  const doc = await prisma.document.create({
    data: {
      name: file.name,
      documentType: docType as never,
      storageKey: key,
      mimeType: file.type,
      fileSize: file.size,
      uploadedById: session.user.id,
      companyId: companyId ?? undefined,
      notes: notes?.trim() || undefined,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    },
  })

  return NextResponse.json({ documentId: doc.id, name: doc.name, kind: 'company' }, { status: 201 })
}
