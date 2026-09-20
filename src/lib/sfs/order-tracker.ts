import { matchCompletedStep, resolveOrderStepPlan, type SfsStepPlan } from '@/lib/sfs/order-step-plan'

export const SFS_TRACKER_STAGES = [
  { key: 'order', label: 'Order received' },
  { key: 'hk', label: 'Package arrived HK' },
  { key: 'chemical', label: 'Package arrived chemical factory' },
  { key: 'gas', label: 'Gas bottle to diamond factory' },
  { key: 'crafting', label: 'Diamond crafting & IGI' },
  { key: 'jewelry', label: 'Jewelling' },
  { key: 'delivery', label: 'Delivery' },
] as const

export type SfsTrackerStageKey = (typeof SFS_TRACKER_STAGES)[number]['key']
export type SfsTrackerStageState = 'done' | 'current' | 'upcoming'

export type SfsTrackerStage = {
  key: SfsTrackerStageKey
  label: string
  state: SfsTrackerStageState
  at: string | null
}

export type SfsTrackerStep = {
  id: string
  phase: string
  stepNumber: number
  particular: string
  planStepId?: string | null
  recordedAt: Date | string
}

export type SfsTrackerOrder = {
  status: string
  createdAt: Date | string
  packageArrivedHkAt?: Date | string | null
  sampleReceivedAt?: Date | string | null
  chemTransformStartAt?: Date | string | null
  chemTransformEndAt?: Date | string | null
  cvdStartAt?: Date | string | null
  craftingEndAt?: Date | string | null
  igiCertificationAt?: Date | string | null
  jewelrySettingEndAt?: Date | string | null
  deliveryAt?: Date | string | null
  stepPlan?: unknown
  steps: SfsTrackerStep[]
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function earliest(dates: Array<Date | null>): Date | null {
  const valid = dates.filter((date): date is Date => date != null)
  if (valid.length === 0) return null
  return valid.reduce((soonest, date) => (date.getTime() < soonest.getTime() ? date : soonest))
}

function stepRecordedAt(plan: SfsStepPlan, steps: SfsTrackerStep[], phase: string, defaultKey: string): Date | null {
  const list = plan[phase] ?? []
  const index = list.findIndex(item => item.defaultKey === defaultKey || item.id === defaultKey)
  if (index < 0) return null
  const phaseSteps = steps.filter(step => step.phase === phase)
  const hit = matchCompletedStep(list[index], index, phaseSteps)
  if (!hit) return null
  return asDate(phaseSteps.find(step => step.id === hit.id)?.recordedAt)
}

/** Seven production stages. Each stage is done from its own dates or completed steps. The first unfinished stage is current. */
export function buildSfsOrderTracker(order: SfsTrackerOrder): SfsTrackerStage[] {
  const plan = resolveOrderStepPlan(order.stepPlan)
  const steps = order.steps
  const signals: Record<SfsTrackerStageKey, Date | null> = {
    order: asDate(order.createdAt),
    hk: asDate(order.packageArrivedHkAt),
    chemical: earliest([
      asDate(order.chemTransformStartAt),
      asDate(order.sampleReceivedAt),
      stepRecordedAt(plan, steps, 'CHEM_TRANSFORM', 'CHEM_TRANSFORM:2'),
    ]),
    gas: earliest([
      asDate(order.cvdStartAt),
      asDate(order.chemTransformEndAt),
      stepRecordedAt(plan, steps, 'CVD', 'CVD:1'),
    ]),
    crafting: earliest([
      asDate(order.igiCertificationAt),
      asDate(order.craftingEndAt),
      stepRecordedAt(plan, steps, 'CRAFTING', 'CRAFTING:3'),
    ]),
    jewelry: earliest([
      asDate(order.jewelrySettingEndAt),
      stepRecordedAt(plan, steps, 'JEWELRY_SETTING', 'JEWELRY_SETTING:2'),
    ]),
    delivery: asDate(order.deliveryAt),
  }

  if (order.status === 'CANCELLED') signals.order = asDate(order.createdAt)

  const firstOpen = SFS_TRACKER_STAGES.findIndex(stage => signals[stage.key] == null)
  return SFS_TRACKER_STAGES.map((stage, index) => {
    const at = signals[stage.key]
    const state: SfsTrackerStageState = at
      ? 'done'
      : index === firstOpen
        ? 'current'
        : 'upcoming'
    return {
      key: stage.key,
      label: stage.label,
      state,
      at: at ? at.toISOString() : null,
    }
  })
}
