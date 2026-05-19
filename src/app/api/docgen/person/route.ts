import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { uploadToR2 } from '@/lib/storage/r2'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const schema = z.object({
  keyPersonId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { keyPersonId } = parsed.data

  const person = await prisma.keyPerson.findUnique({
    where: { id: keyPersonId },
    select: { id: true, nameEn: true, kycCode: true },
  })
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const { generatePersonDDR } = await import('@/lib/docgen/ddr')
    const buffer = await generatePersonDDR(keyPersonId)

    const datestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const storageKey = `docgen/persons/${keyPersonId}/DDR_${datestamp}_${Date.now()}.pdf`
    await uploadToR2(storageKey, buffer, 'application/pdf')

    await logAudit(session!.user.id, 'GENERATE_PERSON_DDR', 'KeyPerson', keyPersonId, null, { keyPersonId })

    return NextResponse.json({ storageKey })
  } catch (err) {
    console.error('[docgen/person]', err)
    const message = (err as Error).message
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
