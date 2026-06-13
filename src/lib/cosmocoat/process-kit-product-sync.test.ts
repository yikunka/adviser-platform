import { describe, expect, it, vi } from 'vitest'
import {
  enrichProcessKitProductsWithLiveFactoryNames,
  syncProcessKitProductsForFactoryProduct,
} from '@/lib/cosmocoat/process-kit-product-sync'

describe('enrichProcessKitProductsWithLiveFactoryNames', () => {
  it('replaces main, hardener, and thinner display names from the live map', () => {
    const nameById = new Map([
      ['fp-main', 'P001 · Updated Main'],
      ['fp-hardener', 'H001 · Updated Hardener'],
      ['fp-thinner', 'T001 · Updated Thinner'],
    ])

    const [product] = enrichProcessKitProductsWithLiveFactoryNames([
      {
        productId: 'fp-main',
        productName: 'P001 · Stale Main',
        hardenerProductId: 'fp-hardener',
        hardenerProductName: 'H001 · Stale Hardener',
        thinnerProductId: 'fp-thinner',
        thinnerProductName: 'T001 · Stale Thinner',
      },
    ], nameById)

    expect(product.productName).toBe('P001 · Updated Main')
    expect(product.hardenerProductName).toBe('H001 · Updated Hardener')
    expect(product.thinnerProductName).toBe('T001 · Updated Thinner')
  })

  it('keeps stored names when a linked factory product no longer exists', () => {
    const [product] = enrichProcessKitProductsWithLiveFactoryNames([
      {
        productId: 'missing',
        productName: 'OLD · Legacy Product',
        hardenerProductId: null,
        hardenerProductName: null,
        thinnerProductId: null,
        thinnerProductName: null,
      },
    ], new Map())

    expect(product.productName).toBe('OLD · Legacy Product')
  })

  it('touches each affected process kit after syncing linked factory-product names', async () => {
    const db = {
      cosTableFactoryProduct: {
        findUnique: vi.fn().mockResolvedValue({
          productCode: 'P001',
          name: 'Updated Main',
        }),
      },
      cosProcessKitProduct: {
        findMany: vi.fn().mockResolvedValue([
          { kitId: 'kit-1' },
          { kitId: 'kit-1' },
          { kitId: 'kit-2' },
        ]),
        updateMany: vi.fn()
          .mockResolvedValueOnce({ count: 2 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      cosProcessKit: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    } as unknown as NonNullable<Parameters<typeof syncProcessKitProductsForFactoryProduct>[1]>

    const result = await syncProcessKitProductsForFactoryProduct('fp-main', db)

    expect(db.cosProcessKitProduct.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { productId: 'fp-main' },
          { hardenerProductId: 'fp-main' },
          { thinnerProductId: 'fp-main' },
        ],
      },
      select: { kitId: true },
    })
    expect(db.cosProcessKit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['kit-1', 'kit-2'] } },
      data: { updatedAt: expect.any(Date) },
    })
    expect(result).toEqual({ updatedCount: 3, touchedKitCount: 2 })
  })
})
