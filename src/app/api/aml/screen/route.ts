import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { screenKeyPerson, screenCompany, screenAll } from '@/lib/aml/screener'
import { z } from 'zod'

const schema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ subjectType: z.enum(['KEY_PERSON', 'COMPANY']), subjectId: z.string() }),
])

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF')
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const data = parsed.data

  if ('all' in data) {
    const result = await screenAll('MANUAL')
    return NextResponse.json(result)
  }

  const { subjectType, subjectId } = data
  let result
  if (subjectType === 'KEY_PERSON') {
    result = await screenKeyPerson(subjectId, 'MANUAL', session.user.id)
  } else {
    result = await screenCompany(subjectId, 'MANUAL', session.user.id)
  }

  return NextResponse.json({ result })
}
