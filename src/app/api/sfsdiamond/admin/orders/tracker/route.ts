import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { summarizeProjectBilling } from '@/lib/adviser/project-labels'
import { buildSfsOrderTracker } from '@/lib/sfs/order-tracker'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'sfsOrders' })
  if (error) return error

  const orders = await prisma.sfsOrder.findMany({
    where: { status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sampleCode: true,
      memorialName: true,
      clientName: true,
      status: true,
      createdAt: true,
      packageArrivedHkAt: true,
      sampleReceivedAt: true,
      chemTransformStartAt: true,
      chemTransformEndAt: true,
      cvdStartAt: true,
      craftingEndAt: true,
      igiCertificationAt: true,
      jewelrySettingEndAt: true,
      deliveryAt: true,
      stepPlan: true,
      steps: {
        select: { id: true, phase: true, stepNumber: true, particular: true, planStepId: true, recordedAt: true },
      },
      invoices: { select: { status: true } },
    },
  })

  const rows = orders.map(order => {
    const stages = buildSfsOrderTracker(order)
    const current = stages.find(stage => stage.state === 'current') ?? stages[stages.length - 1]
    const billing = summarizeProjectBilling(order.invoices.map(invoice => invoice.status))
    return {
      id: order.id,
      sampleCode: order.sampleCode,
      memorialName: order.memorialName,
      clientName: order.clientName,
      status: order.status,
      stages,
      stageKey: current.key,
      stageLabel: current.label,
      stageNumber: stages.findIndex(stage => stage.key === current.key) + 1,
      stageState: current.state,
      invoicingStatus: billing.invoicingStatus,
      collectionStatus: billing.collectionStatus,
    }
  })

  rows.sort((a, b) => a.stageNumber - b.stageNumber || a.memorialName.localeCompare(b.memorialName))

  return NextResponse.json({ orders: rows })
}
