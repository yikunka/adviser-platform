import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { SFS_PHASE_ORDER } from '@/lib/sfs/order-predefined-steps'
import {
  buildDefaultStepPlan,
  insertPlanStep,
  removePlanStep,
  resolveOrderStepPlan,
  type SfsStepPlan,
} from '@/lib/sfs/order-step-plan'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('insert'),
    phase: z.enum(SFS_PHASE_ORDER),
    index: z.number().int().min(0),
    label: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal('remove'),
    phase: z.enum(SFS_PHASE_ORDER),
    planStepId: z.string().min(1),
  }),
  z.object({
    action: z.literal('resetPhase'),
    phase: z.enum(SFS_PHASE_ORDER),
  }),
])

async function renumberPhaseSteps(orderId: string, phase: string, plan: SfsStepPlan) {
  const items = plan[phase] ?? []
  const existing = await prisma.sfsOrderStep.findMany({
    where: { orderId, phase },
    orderBy: { stepNumber: 'asc' },
  })

  const used = new Set<string>()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const match =
      existing.find(s => s.planStepId === item.id && !used.has(s.id))
      ?? existing.find(s => !s.planStepId && s.particular === item.label && !used.has(s.id))
    if (!match) continue
    used.add(match.id)
    await prisma.sfsOrderStep.update({
      where: { id: match.id },
      data: { stepNumber: i + 1, planStepId: item.id, particular: item.label },
    })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission('sfsOrders.manageSteps')
  if (error) return error

  const { id: orderId } = await params
  const order = await prisma.sfsOrder.findUnique({
    where: { id: orderId },
    select: { id: true, stepPlan: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const raw = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  let plan = resolveOrderStepPlan(order.stepPlan)

  if (parsed.data.action === 'insert') {
    const { phase, index, label } = parsed.data
    plan = insertPlanStep(plan, phase, index, label)
  } else if (parsed.data.action === 'remove') {
    const { phase, planStepId } = parsed.data
    const before = plan[phase] ?? []
    const removing = before.find(item => item.id === planStepId)
    plan = removePlanStep(plan, phase, planStepId)

    // Delete completed records for the removed plan row
    if (removing) {
      await prisma.sfsOrderStep.deleteMany({
        where: {
          orderId,
          phase,
          OR: [
            { planStepId },
            { AND: [{ planStepId: null }, { particular: removing.label }] },
          ],
        },
      })
    } else {
      await prisma.sfsOrderStep.deleteMany({ where: { orderId, phase, planStepId } })
    }
  } else {
    const defaults = buildDefaultStepPlan()
    plan = { ...plan, [parsed.data.phase]: defaults[parsed.data.phase] }
  }

  await prisma.sfsOrder.update({
    where: { id: orderId },
    data: { stepPlan: plan },
  })

  const phase =
    parsed.data.action === 'insert' || parsed.data.action === 'remove' || parsed.data.action === 'resetPhase'
      ? parsed.data.phase
      : SFS_PHASE_ORDER[0]
  await renumberPhaseSteps(orderId, phase, plan)

  const updated = await prisma.sfsOrder.findUnique({
    where: { id: orderId },
    include: {
      steps: {
        orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }],
        include: { attachments: { orderBy: { createdAt: 'asc' } } },
      },
      user: { select: { nameEn: true, email: true } },
    },
  })

  return NextResponse.json({
    ...updated,
    resolvedStepPlan: plan,
  })
}
