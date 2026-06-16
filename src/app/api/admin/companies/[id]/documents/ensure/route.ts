import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  await params

  return NextResponse.json({
    nar1: null,
  })
}
