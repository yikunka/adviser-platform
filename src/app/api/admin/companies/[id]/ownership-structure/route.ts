import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import {
  buildCompanyOwnershipNode,
  indexCompaniesByName,
  loadAllCompaniesWithMembers,
} from '@/lib/aml/ownershipLookThrough'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'companies' })
  if (error) return error

  const { id } = await params
  const companies = await loadAllCompaniesWithMembers()
  const root = companies.find(company => company.id === id)
  if (!root) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    structure: buildCompanyOwnershipNode(root, indexCompaniesByName(companies), new Set()),
  })
}
