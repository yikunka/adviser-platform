import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit/logger'
import { prisma } from '@/lib/db/prisma'
import {
  assertCompanyAccessible,
  resolveCompanyAccess,
} from '@/lib/company-access'
import {
  defaultRenewalWindow,
  expireOverdueProjects,
  projectInclude,
  serializeProject,
} from '@/lib/adviser/projects'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  const { session, error } = await requirePermission('projects.create')
  if (error) return error

  const { id } = await context.params
  await expireOverdueProjects([id])

  const source = await prisma.advProject.findUnique({
    where: { id },
    include: { renewedTo: { select: { id: true } } },
  })
  if (!source) return NextResponse.json({ error: '项目不存在。' }, { status: 404 })

  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  if (!(await assertCompanyAccessible(access, source.companyId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (source.renewedTo) {
    return NextResponse.json({ error: '该项目已续期，请打开下一期项目。', nextProjectId: source.renewedTo.id }, { status: 409 })
  }
  if (source.status === 'CANCELLED') {
    return NextResponse.json({ error: '已取消的项目不能续期。' }, { status: 400 })
  }

  const { startDate, endDate } = defaultRenewalWindow(source.endDate)

  const result = await prisma.$transaction(async tx => {
    const next = await tx.advProject.create({
      data: {
        companyId: source.companyId,
        title: source.title,
        projectType: source.projectType,
        status: 'ACTIVE',
        startDate,
        endDate,
        autoRenew: source.autoRenew,
        notes: source.notes,
        renewedFromId: source.id,
        createdById: session!.user.id,
      },
      include: projectInclude,
    })

    await tx.advProject.update({
      where: { id: source.id },
      data: { status: 'RENEWED' },
    })

    return next
  })

  await logAudit(session!.user.id, 'CREATE', 'AdvProject', result.id, null, {
    renewedFromId: source.id,
    action: 'renew',
  })

  return NextResponse.json({
    project: serializeProject(result),
    toast: '已创建下一期项目。',
  }, { status: 201 })
}
