import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit/logger'
import { uploadToR2 } from '@/lib/storage/r2'
import { recordEddPepClear } from '@/lib/aml/screener'
import crypto from 'crypto'

const completeSchema = z.object({
  outcome: z.enum(['CONTINUE', 'REJECT']),
  eddNotes: z.string().min(1),
})

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Complete EDD on an escalated alert: require EDD pack upload + notes,
 * then CONTINUE (unlock PEP CLEAR for key persons) or REJECT.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole('COMPLIANCE', { adminMenu: 'aml' })
  if (error) return error

  const { id } = await params
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 })
  }

  const form = await req.formData()
  const outcome = String(form.get('outcome') ?? '')
  const eddNotesRaw = form.get('eddNotes')
  const eddNotes = typeof eddNotesRaw === 'string' ? eddNotesRaw.trim() : ''
  const parsed = completeSchema.safeParse({ outcome, eddNotes })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'EDD notes and outcome (CONTINUE / REJECT) are required' },
      { status: 400 },
    )
  }

  const fileField = form.get('file')
  const file = fileField instanceof File && fileField.size > 0 ? fileField : null
  if (!file) {
    return NextResponse.json({ error: 'Upload the EDD pack (PDF, JPG, or PNG)' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Only PDF, JPG, PNG allowed.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
  }

  const alert = await prisma.aMLAlert.findUnique({ where: { id } })
  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (alert.resolution !== 'ESCALATED') {
    return NextResponse.json({ error: 'EDD can only be completed on an escalated alert' }, { status: 400 })
  }
  if (alert.eddCompletedAt) {
    return NextResponse.json({ error: 'EDD already completed for this alert' }, { status: 400 })
  }

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : 'png'
  const key = `aml-alerts/${id}/edd/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    await uploadToR2(key, buffer, file.type)
  } catch (err) {
    console.error('[aml/alerts/edd] upload failed:', err)
    return NextResponse.json(
      { error: 'Could not store EDD file. Check storage configuration.' },
      { status: 503 },
    )
  }

  const now = new Date()
  const continueOk = parsed.data.outcome === 'CONTINUE'

  if (continueOk && alert.keyPersonId) {
    try {
      await recordEddPepClear(alert.keyPersonId, parsed.data.eddNotes, {
        alertId: id,
        triggeredById: session.user.id,
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to clear PEP after EDD' },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.aMLAlert.update({
    where: { id },
    data: {
      eddStorageKey: key,
      eddFileName: file.name,
      eddMimeType: file.type,
      eddFileSize: file.size,
      eddNotes: parsed.data.eddNotes,
      eddCompletedAt: now,
      eddCompletedById: session.user.id,
      eddOutcome: parsed.data.outcome,
      isActive: false,
      ...(continueOk
        ? {}
        : {
            resolution: 'REJECTED' as const,
            reviewNotes: alert.reviewNotes
              ? `${alert.reviewNotes}\n\n[EDD reject] ${parsed.data.eddNotes}`
              : `[EDD reject] ${parsed.data.eddNotes}`,
            reviewedById: session.user.id,
            reviewedAt: now,
          }),
    },
  })

  await logAudit(session.user.id, 'COMPLETE_AML_EDD', 'AMLAlert', id, alert, updated)
  return NextResponse.json(updated)
}
