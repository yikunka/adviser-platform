import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'

type RouteContext = { params: Promise<{ id: string; linkId: string }> }

const paymentSchema = z.object({
  paid: z.boolean(),
})

async function loadLink(projectId: string, linkId: string) {
  return prisma.advProjectInvoice.findFirst({
    where: { id: linkId, projectId },
    include: {
      project: { select: { companyId: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          total: true,
          billToName: true,
        },
      },
    },
  })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id, linkId } = await context.params
  const link = await loadLink(id, linkId)
  if (!link) return NextResponse.json({ error: '关联不存在。' }, { status: 404 })

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, link.project.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = link.invoice.status
  if (current !== 'SENT' && current !== 'PAID') {
    return NextResponse.json({
      error: '仅已发送（未收款）或已收款的发票可通过勾选确认收款状态。',
    }, { status: 400 })
  }

  const nextStatus = parsed.data.paid ? 'PAID' : 'SENT'
  if (current === nextStatus) {
    return NextResponse.json({
      link: {
        id: link.id,
        createdAt: link.createdAt.toISOString(),
        invoice: {
          ...link.invoice,
          issueDate: link.invoice.issueDate.toISOString(),
          dueDate: link.invoice.dueDate?.toISOString() ?? null,
          total: link.invoice.total.toString(),
        },
      },
    })
  }

  const invoice = await prisma.invoice.update({
    where: { id: link.invoice.id },
    data: { status: nextStatus },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      total: true,
      billToName: true,
    },
  })

  await logAudit(session!.user.id, 'UPDATE', 'Invoice', invoice.id, { status: current }, { status: nextStatus })

  return NextResponse.json({
    link: {
      id: link.id,
      createdAt: link.createdAt.toISOString(),
      invoice: {
        ...invoice,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate?.toISOString() ?? null,
        total: invoice.total.toString(),
      },
    },
    toast: nextStatus === 'PAID' ? '已确认收款。' : '已取消收款确认。',
  })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id, linkId } = await context.params
  const link = await loadLink(id, linkId)
  if (!link) return NextResponse.json({ error: '关联不存在。' }, { status: 404 })

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, link.project.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.advProjectInvoice.delete({ where: { id: linkId } })
  await logAudit(session!.user.id, 'DELETE', 'AdvProjectInvoice', linkId, link, null)
  return NextResponse.json({ toast: `已取消关联发票 ${link.invoice.invoiceNumber}。` })
}
