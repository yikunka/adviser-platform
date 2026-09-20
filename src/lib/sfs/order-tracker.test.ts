import { describe, expect, it } from 'vitest'
import { buildSfsOrderTracker } from '@/lib/sfs/order-tracker'

const created = '2026-09-01T00:00:00.000Z'

function order(patch: Record<string, unknown> = {}) {
  return {
    status: 'CONFIRMED',
    createdAt: created,
    steps: [],
    ...patch,
  }
}

describe('buildSfsOrderTracker', () => {
  it('starts at Hong Kong after the order is received', () => {
    const stages = buildSfsOrderTracker(order())
    expect(stages.map(stage => stage.state)).toEqual([
      'done', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ])
    expect(stages[0].at).toBe(created)
  })

  it('keeps a later stage done when an earlier date is still missing', () => {
    const stages = buildSfsOrderTracker(order({
      igiCertificationAt: '2026-09-10T00:00:00.000Z',
    }))
    expect(stages.find(stage => stage.key === 'hk')?.state).toBe('current')
    expect(stages.find(stage => stage.key === 'crafting')?.state).toBe('done')
  })

  it('marks chemical arrival from the production-site step', () => {
    const stages = buildSfsOrderTracker(order({
      packageArrivedHkAt: '2026-09-02T00:00:00.000Z',
      steps: [{
        id: 'step-1',
        phase: 'CHEM_TRANSFORM',
        stepNumber: 2,
        particular: 'Package arrived production site',
        planStepId: 'CHEM_TRANSFORM:2',
        recordedAt: '2026-09-03T00:00:00.000Z',
      }],
    }))
    expect(stages.find(stage => stage.key === 'chemical')?.state).toBe('done')
    expect(stages.find(stage => stage.key === 'gas')?.state).toBe('current')
  })
})
