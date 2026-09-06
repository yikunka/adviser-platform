import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), updateMany: vi.fn() }))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      sfsCustomer: { upsert: mocks.upsert },
      sfsOrder: { updateMany: mocks.updateMany },
    }),
  },
}))

import { claimAnonymousSfsOrdersForUser } from './account-binding'

describe('claimAnonymousSfsOrdersForUser', () => {
  it('binds only unowned orders with the verified email to the registered SFS profile', async () => {
    mocks.upsert.mockResolvedValueOnce({ id: 'cm123456789012345678901234' })
    mocks.updateMany.mockResolvedValueOnce({ count: 3 })

    await expect(claimAnonymousSfsOrdersForUser('cm123456789012345678901235', ' Client@Example.com ')).resolves.toBe(3)
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { userId: null, email: { equals: 'client@example.com', mode: 'insensitive' } },
      data: { userId: 'cm123456789012345678901235', customerId: 'cm123456789012345678901234' },
    })
  })
})
