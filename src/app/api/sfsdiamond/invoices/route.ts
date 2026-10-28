import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { getSfsAccountAccess, sfsApprovalForbiddenResponse } from '@/lib/sfs/account-approval'

/** Partner-visible invoices linked to their orders (excludes DRAFT / CANCELLED). */
export async function GET() {
  const session = await auth()
  if (!session || session.user.platform !== 'SFS_DIAMOND') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const access = await getSfsAccountAccess(session.user.id, session.user.platform)
  if (!access.approved) return sfsApprovalForbiddenResponse(access.status)

  const invoices = await prisma.sfsInvoice.findMany({
    where: {
      status: { in: ['SENT', 'PAID'] },
      orderId: { not: null },
      order: { userId: session.user.id },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      currency: true,
      total: true,
      issueDate: true,
      order: {
        select: {
          id: true,
          sampleCode: true,
          memorialName: true,
        },
      },
    },
  })

  return NextResponse.json(
    invoices.flatMap(inv => {
      if (!inv.order) return []
      return [{
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        currency: inv.currency,
        total: Number(inv.total),
        issueDate: inv.issueDate,
        orderId: inv.order.id,
        sampleCode: inv.order.sampleCode,
        memorialName: inv.order.memorialName,
      }]
    }),
  )
}
