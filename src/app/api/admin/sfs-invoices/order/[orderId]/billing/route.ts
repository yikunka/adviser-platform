import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { sfsOrderBillingSnapshot } from '@/lib/sfs-invoice/order-billing'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsInvoices' })
  if (error) return error

  const { orderId } = await params
  const billing = await sfsOrderBillingSnapshot(orderId)
  if (!billing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  return NextResponse.json(billing)
}
