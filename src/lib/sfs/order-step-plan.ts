import {
  SFS_PHASE_ORDER,
  SFS_PREDEFINED_STEPS,
  sfsDefaultStepKey,
} from '@/lib/sfs/order-predefined-steps'

function newPlanStepId() {
  return crypto.randomUUID()
}

export type SfsPlanStep = {
  id: string
  label: string
  kind: 'default' | 'custom'
  /** Original predefined slot, e.g. "CVD:5" — drives weight / photo UI */
  defaultKey?: string
}

export type SfsStepPlan = Record<string, SfsPlanStep[]>

export function buildDefaultStepPlan(): SfsStepPlan {
  const plan: SfsStepPlan = {}
  for (const phase of SFS_PHASE_ORDER) {
    const labels = SFS_PREDEFINED_STEPS[phase] ?? []
    plan[phase] = labels.map((label, i) => {
      const defaultKey = sfsDefaultStepKey(phase, i + 1)
      return { id: defaultKey, label, kind: 'default' as const, defaultKey }
    })
  }
  return plan
}

export function isSfsStepPlan(value: unknown): value is SfsStepPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return true
}

/** Resolve stored plan or fall back to global defaults. */
export function resolveOrderStepPlan(stored: unknown): SfsStepPlan {
  const defaults = buildDefaultStepPlan()
  if (!isSfsStepPlan(stored)) return defaults

  const out: SfsStepPlan = {}
  for (const phase of SFS_PHASE_ORDER) {
    const raw = (stored as SfsStepPlan)[phase]
    if (!Array.isArray(raw) || raw.length === 0) {
      out[phase] = defaults[phase]
      continue
    }
    out[phase] = raw
      .filter(item => item && typeof item === 'object' && typeof (item as SfsPlanStep).label === 'string')
      .map(item => {
        const row = item as SfsPlanStep
        const kind = row.kind === 'custom' ? 'custom' : 'default'
        const id = typeof row.id === 'string' && row.id ? row.id : newPlanStepId()
        const defaultKey = typeof row.defaultKey === 'string' ? row.defaultKey : (kind === 'default' ? id : undefined)
        return { id, label: row.label, kind, ...(defaultKey ? { defaultKey } : {}) }
      })
    if (out[phase].length === 0) out[phase] = defaults[phase]
  }
  return out
}

export function countOrderPlanSteps(plan: SfsStepPlan) {
  return SFS_PHASE_ORDER.reduce((sum, phase) => sum + (plan[phase]?.length ?? 0), 0)
}

export function insertPlanStep(
  plan: SfsStepPlan,
  phase: string,
  index: number,
  label: string,
): SfsStepPlan {
  const list = [...(plan[phase] ?? [])]
  const clamped = Math.max(0, Math.min(index, list.length))
  list.splice(clamped, 0, {
    id: newPlanStepId(),
    label: label.trim(),
    kind: 'custom',
  })
  return { ...plan, [phase]: list }
}

export function removePlanStep(
  plan: SfsStepPlan,
  phase: string,
  planStepId: string,
): SfsStepPlan {
  const list = (plan[phase] ?? []).filter(item => item.id !== planStepId)
  return { ...plan, [phase]: list }
}

export type CompletedStepLike = {
  id: string
  phase: string
  stepNumber: number
  particular: string
  planStepId?: string | null
}

/** Match a completed DB step to a plan row (planStepId → label → stepNumber). */
export function matchCompletedStep(
  planItem: SfsPlanStep,
  index: number,
  steps: CompletedStepLike[],
) {
  return (
    steps.find(s => s.planStepId && s.planStepId === planItem.id)
    ?? steps.find(s => !s.planStepId && s.particular === planItem.label)
    ?? steps.find(s => !s.planStepId && s.stepNumber === index + 1)
  )
}
