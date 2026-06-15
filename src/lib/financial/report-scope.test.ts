import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db/prisma'
import { resolveFinancialReportScope } from './report-scope'
import { resolveReportGroupCompanyIds } from './report-groups'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    company: { findUnique: vi.fn() },
  },
}))

vi.mock('./report-groups', () => ({
  resolveReportGroupCompanyIds: vi.fn(),
}))

describe('resolveFinancialReportScope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the validated company scope when the company exists and is enabled', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-1',
      financialEnabled: true,
    } as never)

    await expect(
      resolveFinancialReportScope(
        { kind: 'restricted', companyIds: ['company-1'] },
        { companyId: 'company-1' },
      ),
    ).resolves.toEqual({ companyId: 'company-1' })
  })

  it('rejects missing or disabled financial companies', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null as never)

    await expect(
      resolveFinancialReportScope({ kind: 'all' }, { companyId: 'missing-company' }),
    ).rejects.toThrow('Financial company not found')
  })

  it('rejects inaccessible companies even when they exist', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      id: 'company-2',
      financialEnabled: true,
    } as never)

    await expect(
      resolveFinancialReportScope(
        { kind: 'restricted', companyIds: ['company-1'] },
        { companyId: 'company-2' },
      ),
    ).rejects.toThrow('Forbidden')
  })

  it('delegates report groups to the group resolver', async () => {
    vi.mocked(resolveReportGroupCompanyIds).mockResolvedValue(['company-1', 'company-2'])

    await expect(
      resolveFinancialReportScope({ kind: 'all' }, { reportGroupId: 'group-1' }),
    ).resolves.toEqual({ companyIds: ['company-1', 'company-2'] })
  })
})
