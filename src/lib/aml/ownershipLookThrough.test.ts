import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import {
  buildCompanyOwnershipNode,
  computeEffectiveNaturalOwners,
  indexCompaniesById,
  indexCompaniesByName,
  normalizeName,
  type CompanyWithMembers,
} from '@/lib/aml/ownershipLookThrough'

function company(
  partial: Partial<CompanyWithMembers> & Pick<CompanyWithMembers, 'id' | 'nameEn'>,
): CompanyWithMembers {
  return {
    nameZh: null,
    companyNumber: null,
    companyType: 'HK',
    members: [],
    ...partial,
  }
}

function member(
  partial: Partial<CompanyWithMembers['members'][number]> & {
    id: string
    nameEn: string
    sharesHeld: number
  },
): CompanyWithMembers['members'][number] {
  const { sharesHeld, ...rest } = partial
  return {
    keyPersonId: null,
    linkedCompanyId: null,
    nameZh: null,
    shareClass: 'ORDINARY',
    status: 'ACTIVE',
    shareTransactions: [{ sharesHeld, transactionDate: new Date('2024-01-01') }],
    ...rest,
  }
}

describe('normalizeName', () => {
  it('matches ltd / limited and hyphen variants', () => {
    expect(normalizeName('Bull-fund Consulting (Hong Kong) Co., Limited')).toBe(
      normalizeName('Bull Fund Consulting Hong Kong Company Limited'),
    )
    expect(normalizeName('Sync Capital Ltd')).toBe(normalizeName('Sync Capital Limited'))
  })
})

describe('buildCompanyOwnershipNode', () => {
  it('expands corporate shareholders upward and keeps peer stakes on the subject', () => {
    const mshov = company({
      id: 'mshov',
      nameEn: 'Mshov Limited',
      companyNumber: '76441074',
      members: [
        member({ id: 'm-lun', nameEn: 'Lun Zhang', nameZh: '張倫', sharesHeld: 10000 }),
      ],
    })
    const capital = company({
      id: 'capital',
      nameEn: '6AM Capital Limited',
      companyNumber: '76460139',
      members: [
        member({
          id: 'm-mshov',
          nameEn: 'Mshov Limited',
          linkedCompanyId: 'mshov',
          sharesHeld: 460000,
        }),
        member({
          id: 'm-bull',
          nameEn: 'Bull-fund Consulting (Hong Kong) Co., Limited',
          sharesHeld: 440000,
        }),
        member({
          id: 'm-sync',
          nameEn: 'Sync Capital Limited',
          sharesHeld: 100000,
        }),
      ],
    })

    const companies = [mshov, capital]
    const tree = buildCompanyOwnershipNode(
      capital,
      indexCompaniesByName(companies),
      new Set(),
      undefined,
      indexCompaniesById(companies),
    )

    expect(tree.nameEn).toBe('6AM Capital Limited')
    expect(tree.ownershipPercent).toBeNull()
    expect(tree.children).toHaveLength(3)

    const byName = Object.fromEntries(tree.children.map(c => [c.nameEn, c]))
    expect(byName['Mshov Limited']?.type).toBe('COMPANY')
    expect(byName['Mshov Limited']?.ownershipPercent).toBe(46)
    expect(byName['Mshov Limited']?.children).toHaveLength(1)
    expect(byName['Mshov Limited']?.children[0]?.nameEn).toBe('Lun Zhang')
    expect(byName['Mshov Limited']?.children[0]?.ownershipPercent).toBe(100)

    expect(byName['Bull-fund Consulting (Hong Kong) Co., Limited']?.type).toBe('PERSON')
    expect(byName['Bull-fund Consulting (Hong Kong) Co., Limited']?.ownershipPercent).toBe(44)
    expect(byName['Sync Capital Limited']?.ownershipPercent).toBe(10)
  })

  it('matches corporate shareholders by normalized name when linkedCompanyId is missing', () => {
    const bull = company({
      id: 'bull',
      nameEn: 'Bull Fund Consulting Hong Kong Company Limited',
      members: [member({ id: 'b1', nameEn: 'Owner A', sharesHeld: 1 })],
    })
    const subject = company({
      id: 'subject',
      nameEn: 'Subject Co Ltd',
      members: [
        member({
          id: 'm1',
          nameEn: 'Bull-fund Consulting (Hong Kong) Co., Limited',
          sharesHeld: 100,
        }),
      ],
    })
    const companies = [bull, subject]
    const tree = buildCompanyOwnershipNode(
      subject,
      indexCompaniesByName(companies),
      new Set(),
      undefined,
      indexCompaniesById(companies),
    )
    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.type).toBe('COMPANY')
    expect(tree.children[0]?.companyId).toBe('bull')
    expect(tree.children[0]?.children[0]?.nameEn).toBe('Owner A')
  })

  it('computes look-through UBO through a corporate shareholder', () => {
    const holdco = company({
      id: 'holdco',
      nameEn: 'Hold Co',
      members: [member({ id: 'p', nameEn: 'Alice', keyPersonId: 'kp1', sharesHeld: 100 })],
    })
    const opco = company({
      id: 'opco',
      nameEn: 'Op Co',
      members: [
        member({ id: 'h', nameEn: 'Hold Co', linkedCompanyId: 'holdco', sharesHeld: 60 }),
        member({ id: 'b', nameEn: 'Bob', keyPersonId: 'kp2', sharesHeld: 40 }),
      ],
    })
    const companies = [holdco, opco]
    const tree = buildCompanyOwnershipNode(
      opco,
      indexCompaniesByName(companies),
      new Set(),
      undefined,
      indexCompaniesById(companies),
    )
    const ubos = computeEffectiveNaturalOwners(tree, 25)
    expect(ubos.map(u => ({ name: u.nameEn, pct: u.effectivePercent }))).toEqual([
      { name: 'Alice', pct: 60 },
      { name: 'Bob', pct: 40 },
    ])
  })
})
