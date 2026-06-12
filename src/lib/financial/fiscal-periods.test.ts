import { describe, expect, it } from 'vitest'
import type { FiscalPeriodStatus } from '@prisma/client'
import { assertPeriodOpen, PeriodClosedError } from './fiscal-periods'

function fakePeriodClient(status: FiscalPeriodStatus | null) {
  return {
    fiscalPeriod: {
      async findUnique() {
        return status ? { status } : null
      },
    },
  }
}

describe('fiscal period guard', () => {
  it('allows posting when no period row exists (implicit OPEN)', async () => {
    await expect(assertPeriodOpen(fakePeriodClient(null), 'c1', '2026-06')).resolves.toBeUndefined()
  })

  it('allows posting when period is OPEN', async () => {
    await expect(assertPeriodOpen(fakePeriodClient('OPEN'), 'c1', '2026-06')).resolves.toBeUndefined()
  })

  it('blocks posting when period is CLOSED', async () => {
    await expect(assertPeriodOpen(fakePeriodClient('CLOSED'), 'c1', '2026-05')).rejects.toThrow(PeriodClosedError)
    await expect(assertPeriodOpen(fakePeriodClient('CLOSED'), 'c1', '2026-05')).rejects.toThrow('已关账')
  })

  it('blocks posting when period is LOCKED', async () => {
    await expect(assertPeriodOpen(fakePeriodClient('LOCKED'), 'c1', '2026-05')).rejects.toThrow('已锁定')
  })
})
