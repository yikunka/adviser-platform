import { describe, expect, it } from 'vitest'
import { DEFAULT_MAPPING_CODES, MappingNotFoundError, resolveMappedAccountId } from './account-mappings'

function fakeClient(options: { mappingAccountId?: string; fallbackAccounts?: Record<string, string> }) {
  return {
    accountMapping: {
      async findUnique() {
        return options.mappingAccountId ? { accountId: options.mappingAccountId } : null
      },
    },
    finAccount: {
      async findFirst(args: { where: { companyId: string; code: string }; select: { id: true } }) {
        const id = options.fallbackAccounts?.[args.where.code]
        return id ? { id } : null
      },
    },
  }
}

describe('account mapping resolution', () => {
  it('prefers explicit mapping', async () => {
    const client = fakeClient({ mappingAccountId: 'acc-explicit', fallbackAccounts: { '1100': 'acc-default' } })
    expect(await resolveMappedAccountId(client, 'c1', 'AR_CONTROL')).toBe('acc-explicit')
  })

  it('falls back to default chart code', async () => {
    const client = fakeClient({ fallbackAccounts: { '1100': 'acc-ar', '2001': 'acc-ap' } })
    expect(await resolveMappedAccountId(client, 'c1', 'AR_CONTROL')).toBe('acc-ar')
    expect(await resolveMappedAccountId(client, 'c1', 'AP_CONTROL')).toBe('acc-ap')
  })

  it('throws descriptive error when nothing resolves', async () => {
    const client = fakeClient({})
    await expect(resolveMappedAccountId(client, 'c1', 'OUTPUT_TAX')).rejects.toThrow(MappingNotFoundError)
    await expect(resolveMappedAccountId(client, 'c1', 'OUTPUT_TAX')).rejects.toThrow('销项税')
  })

  it('covers every mapping key with a fallback code', () => {
    for (const code of Object.values(DEFAULT_MAPPING_CODES)) {
      expect(code).toMatch(/^\d{4}$/)
    }
  })
})
