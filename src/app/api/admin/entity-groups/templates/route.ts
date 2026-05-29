import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { ENTITY_GROUP_TEMPLATES } from '@/lib/entity-groups/templates'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'entities' })
  if (error) return error

  return NextResponse.json({ templates: ENTITY_GROUP_TEMPLATES })
}
