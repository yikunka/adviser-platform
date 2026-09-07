import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'

type RouteContext = { params: Promise<{ id: string; linkId: string }> }

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id, linkId } = await context.params
  const link = await prisma.advProjectInvoice.findFirst({
    where: { id: linkId, projectId: id },
    include: {
      project: { select: { companyId: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  })
  if (!link) return NextResponse.json({ error: '关联不存在。' }, { status: 404 })

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, link.project.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.advProjectInvoice.delete({ where: { id: linkId } })
  await logAudit(session!.user.id, 'DELETE', 'AdvProjectInvoice', linkId, link, null)
  return NextResponse.json({ toast: `已取消关联发票 ${link.invoice.invoiceNumber}。` })
}
