import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/logger'
import { uploadToR2 } from '@/lib/storage/r2'
import crypto from 'crypto'

const resolveSchema = z.object({
  resolution: z.enum(['FALSE_POSITIVE', 'ESCALATED', 'REJECTED']),
  reviewNotes: z.string().optional(),
})

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole('STAFF', { adminMenu: 'aml' })
  if (error) return error

  const { id } = await params
  const alert = await prisma.aMLAlert.findUnique({
    where: { id },
    include: {
      amlRecord: {
        include: { source: true },
      },
    },
  })

  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Resolve subject name without schema relations
  let subjectName: string | null = null
  if (alert.keyPersonId) {
    const p = await prisma.keyPerson.findUnique({ where: { id: alert.keyPersonId }, select: { nameEn: true } })
    subjectName = p?.nameEn ?? null
  } else if (alert.companyId) {
    const c = await prisma.company.findUnique({ where: { id: alert.companyId }, select: { nameEn: true } })
    subjectName = c?.nameEn ?? null
  }

  return NextResponse.json({ ...alert, subjectName })
}

async function parseResolveBody(req: NextRequest): Promise<{
  data: z.infer<typeof resolveSchema>
  file: File | null
  error?: NextResponse
}> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const resolution = String(form.get('resolution') ?? '')
    const reviewNotesRaw = form.get('reviewNotes')
    const reviewNotes =
      typeof reviewNotesRaw === 'string' && reviewNotesRaw.trim()
        ? reviewNotesRaw.trim()
        : undefined
    const parsed = resolveSchema.safeParse({ resolution, reviewNotes })
    if (!parsed.success) {
      return {
        data: { resolution: 'FALSE_POSITIVE' },
        file: null,
        error: NextResponse.json({ error: 'Invalid input' }, { status: 400 }),
      }
    }
    const fileField = form.get('file')
    const file = fileField instanceof File && fileField.size > 0 ? fileField : null
    return { data: parsed.data, file }
  }

  const body = await req.json()
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) {
    return {
      data: { resolution: 'FALSE_POSITIVE' },
      file: null,
      error: NextResponse.json({ error: 'Invalid input' }, { status: 400 }),
    }
  }
  return { data: parsed.data, file: null }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole('COMPLIANCE', { adminMenu: 'aml' })
  if (error) return error

  const { id } = await params
  const { data, file, error: parseError } = await parseResolveBody(req)
  if (parseError) return parseError

  const alert = await prisma.aMLAlert.findUnique({ where: { id } })
  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let evidence: {
    evidenceStorageKey: string
    evidenceFileName: string
    evidenceMimeType: string
    evidenceFileSize: number
  } | undefined

  if (file) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, JPG, PNG allowed.' },
        { status: 400 },
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : 'png'
    const key = `aml-alerts/${id}/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
      await uploadToR2(key, buffer, file.type)
    } catch (err) {
      console.error('[aml/alerts] evidence upload failed:', err)
      return NextResponse.json(
        { error: 'Could not store supporting file. Check storage configuration.' },
        { status: 503 },
      )
    }
    evidence = {
      evidenceStorageKey: key,
      evidenceFileName: file.name,
      evidenceMimeType: file.type,
      evidenceFileSize: file.size,
    }
  }

  const updated = await prisma.aMLAlert.update({
    where: { id },
    data: {
      resolution: data.resolution,
      reviewNotes: data.reviewNotes,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      isActive: data.resolution === 'ESCALATED',
      ...evidence,
    },
  })

  await logAudit(session.user.id, 'RESOLVE_AML_ALERT', 'AMLAlert', id, alert, updated)
  return NextResponse.json(updated)
}
