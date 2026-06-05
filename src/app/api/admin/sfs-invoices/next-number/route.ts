import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { nextSfsInvoiceNumber } from '@/lib/sfs-invoice/number'

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const issueDateParam = req.nextUrl.searchParams.get('issueDate')
  const issueDate = issueDateParam ? new Date(issueDateParam) : new Date()
  if (Number.isNaN(issueDate.getTime())) {
    return NextResponse.json({ error: 'Invalid issue date' }, { status: 400 })
  }

  const invoiceNumber = await nextSfsInvoiceNumber(issueDate)
  return NextResponse.json({ invoiceNumber })
}
