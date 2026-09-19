import type { AdvProject, Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  buildCompanyAccessWhere,
  resolveCompanyAccess,
  type CompanyAccess,
} from '@/lib/company-access'
import { summarizeProjectBilling } from '@/lib/adviser/project-labels'

export { PROJECT_TYPES, PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from '@/lib/adviser/project-labels'

export const projectInclude = {
  company: { select: { id: true, nameEn: true, companyCode: true } },
  keyPerson: { select: { id: true, nameEn: true, kycCode: true } },
  createdBy: { select: { id: true, nameEn: true, email: true } },
  renewedFrom: { select: { id: true, title: true, projectNumber: true, startDate: true, endDate: true } },
  renewedTo: { select: { id: true, title: true, projectNumber: true, startDate: true, endDate: true } },
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

type ProjectAccessFields = Pick<AdvProject, 'companyId' | 'customerType' | 'keyPersonId'>

function addOneYear(date: Date): Date {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + 1)
  return next
}

/** Mark ACTIVE projects past endDate as EXPIRED (null endDate = no expiry). */
export async function expireOverdueProjects(ids?: string[]) {
  const now = new Date()
  await prisma.advProject.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: { not: null, lt: now },
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

/** Company-scoped projects respect company access; individual KYC projects are open to all project staff. */
export async function assertAdvProjectAccessible(
  project: ProjectAccessFields,
  userId: string,
  role: UserRole,
  access?: CompanyAccess,
): Promise<boolean> {
  if (project.customerType === 'INDIVIDUAL' || !project.companyId) return true
  const resolved = access ?? await resolveCompanyAccess(userId, role)
  return assertCompanyAccessible(resolved, project.companyId)
}

export function buildAdvProjectListAccessFilter(access: CompanyAccess): Prisma.AdvProjectWhereInput | undefined {
  const companyFilter = buildCompanyAccessWhere(access)
  if (!companyFilter) return undefined
  return {
    OR: [
      { customerType: 'INDIVIDUAL' },
      { company: companyFilter },
    ],
  }
}

export function serializeProject(project: ProjectWithRelations) {
  const openTasks = project.tasks.filter(t => t.status === 'OPEN').length
  const linked = project.invoices.map(link => link.invoice)
  const paidCount = linked.filter(inv => inv.status === 'PAID').length
  const unpaidCount = linked.filter(inv => inv.status === 'SENT').length
  const billing = summarizeProjectBilling(linked.map(inv => inv.status))

  return {
    ...project,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
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
      invoicingStatus: billing.invoicingStatus,
      collectionStatus: billing.collectionStatus,
      hasPeriod: Boolean(project.startDate && project.endDate),
    },
  }
}
