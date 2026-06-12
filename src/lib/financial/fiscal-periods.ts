import type { FiscalPeriodStatus } from '@prisma/client'

type FiscalPeriodClient = {
  fiscalPeriod: {
    findUnique(args: {
      where: { companyId_period: { companyId: string; period: string } }
      select: { status: true }
    }): Promise<{ status: FiscalPeriodStatus } | null>
  }
}

/** 期间被关账/锁定时抛出；API 层捕获后转 400。 */
export class PeriodClosedError extends Error {
  readonly period: string

  constructor(period: string, status: FiscalPeriodStatus) {
    super(periodClosedMessage(period, status))
    this.name = 'PeriodClosedError'
    this.period = period
  }
}

export function periodClosedMessage(period: string, status: FiscalPeriodStatus) {
  return status === 'LOCKED'
    ? `会计期间 ${period} 已锁定，禁止过账。`
    : `会计期间 ${period} 已关账，禁止过账。`
}

/**
 * 过账前校验期间状态。无 FiscalPeriod 记录 = OPEN（默认开放，
 * 不要求预先生成期间），有记录且非 OPEN 则抛 PeriodClosedError。
 */
export async function assertPeriodOpen(client: FiscalPeriodClient, companyId: string, period: string) {
  const row = await client.fiscalPeriod.findUnique({
    where: { companyId_period: { companyId, period } },
    select: { status: true },
  })
  if (row && row.status !== 'OPEN') {
    throw new PeriodClosedError(period, row.status)
  }
}
