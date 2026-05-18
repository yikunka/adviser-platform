import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { generateAndStoreCompanyDocument } from '@/lib/docgen/store'
import { z } from 'zod'

const schema = z.object({
  type: z.enum(['ROD', 'ROM', 'ROSC', 'DDR', 'NAR1']),
  companyId: z.string(),
  ddrId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { type, companyId, ddrId } = parsed.data

  try {
    const doc = await generateAndStoreCompanyDocument({
      type,
      companyId,
      uploadedById: session.user.id,
      ...(type === 'DDR' && ddrId ? { notes: `DDR: ${ddrId}` } : {}),
    })
    await logAudit(session.user.id, `GENERATE_${type}`, 'Document', doc.id, null, { companyId, type })
    return NextResponse.json({ documentId: doc.id, storageKey: doc.storageKey })
  } catch (err) {
    console.error('[docgen]', err)
    const message = (err as Error).message
    return NextResponse.json({ error: message }, { status: message === 'Company not found' ? 404 : 500 })
  }
}
