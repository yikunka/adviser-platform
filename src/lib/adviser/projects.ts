import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export { PROJECT_TYPES, PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from '@/lib/adviser/project-labels'

export const projectInclude = {
  company: { select: { id: true, nameEn: true, companyCode: true } },
  createdBy: { select: { id: true, nameEn: true, email: true } },
  renewedFrom: { select: { id: true, title: true, startDate: true, endDate: true } },
  renewedTo: { select: { id: true, title: true, startDate: true, endDate: true } },
  tasks: {
    orderBy: [{ status: 'asc' as const }, { registeredAt: 'desc' as const }],
    include: {
      createdBy: { select: { nameEn: true } },
      completedBy: { select: { nameEn: true } },
    },
  },
  invoices: {
    orderBy: { createdAt: 'desc' as const },
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
  },
  _count: { select: { tasks: true, invoices: true } },
} satisfies Prisma.AdvProjectInclude

export type ProjectWithRelations = Prisma.AdvProjectGetPayload<{ include: typeof projectInclude }>

function addOneYear(date: Date): Date {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + 1)
  return next
}

/** Mark ACTIVE projects past endDate as EXPIRED (best-effort write-through). */
export async function expireOverdueProjects(ids?: string[]) {
  const now = new Date()
  await prisma.advProject.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: now },
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { status: 'EXPIRED' },
  })
}

export function defaultRenewalWindow(fromEndDate: Date): { startDate: Date; endDate: Date } {
  return {
    startDate: fromEndDate,
    endDate: addOneYear(fromEndDate),
  }
}

export function serializeProject(project: ProjectWithRelations) {
  const openTasks = project.tasks.filter(t => t.status === 'OPEN').length
  const linked = project.invoices.map(link => link.invoice)
  const paidCount = linked.filter(inv => inv.status === 'PAID').length
  const unpaidCount = linked.filter(inv => inv.status === 'SENT').length

  return {
    ...project,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    tasks: project.tasks.map(task => ({
      ...task,
      registeredAt: task.registeredAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    invoices: project.invoices.map(link => ({
      id: link.id,
      createdAt: link.createdAt.toISOString(),
      invoice: {
        ...link.invoice,
        issueDate: link.invoice.issueDate.toISOString(),
        dueDate: link.invoice.dueDate?.toISOString() ?? null,
        total: link.invoice.total.toString(),
      },
    })),
    summary: {
      openTasks,
      taskCount: project._count.tasks,
      invoiceCount: project._count.invoices,
      paidCount,
      unpaidCount,
    },
  }
}
