import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { ensureNar1Document } from '@/lib/docgen/store'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params

  const nar1 = await ensureNar1Document(id, session!.user.id)

  return NextResponse.json({
    nar1: nar1 ? { id: nar1.id } : null,
  })
}
