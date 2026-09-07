import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { z } from 'zod'
import { requirePermission, requireRole } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import { expireOverdueProjects } from '@/lib/adviser/projects'

const linkSchema = z.object({
  invoiceId: z.string().cuid(),
})

type RouteContext = { params: Promise<{ id: string }> }

async function assertProjectAccess(projectId: string, userId: string, role: UserRole) {
  await expireOverdueProjects([projectId])
  const project = await prisma.advProject.findUnique({
    where: { id: projectId },
    select: { id: true, companyId: true },
  })
  if (!project) return { project: null as null, forbidden: false }
  const access = await resolveCompanyAccess(userId, role)
  if (!(await assertCompanyAccessible(access, project.companyId))) {
    return { project: null, forbidden: true }
  }
  return { project, forbidden: false }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'projects' })
  if (error) return error

  const { id } = await context.params
  const { project, forbidden } = await assertProjectAccess(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!project) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: project.companyId,
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q, mode: 'insensitive' } },
              { billToName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      projectLinks: { none: { projectId: id } },
    },
    orderBy: { issueDate: 'desc' },
    take: 50,
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

  return NextResponse.json({
    invoices: invoices.map(inv => ({
      ...inv,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate?.toISOString() ?? null,
      total: inv.total.toString(),
    })),
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.edit')
  if (error) return error

  const { id } = await context.params
  const { project, forbidden } = await assertProjectAccess(id, session!.user.id, session!.user.role)
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!project) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = linkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: { id: true, companyId: true, invoiceNumber: true },
  })
  if (!invoice) return NextResponse.json({ error: '发票不存在。' }, { status: 404 })
  if (invoice.companyId !== project.companyId) {
    return NextResponse.json({ error: '只能关联同一公司的发票。' }, { status: 400 })
  }

  try {
    const link = await prisma.advProjectInvoice.create({
      data: { projectId: id, invoiceId: invoice.id },
      include: {
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

    await logAudit(session!.user.id, 'CREATE', 'AdvProjectInvoice', link.id, null, link)
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
      toast: `已关联发票 ${invoice.invoiceNumber}。`,
    }, { status: 201 })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json({ error: '该发票已关联到此项目。' }, { status: 409 })
    }
    throw err
  }
}
