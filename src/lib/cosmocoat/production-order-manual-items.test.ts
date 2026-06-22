import { describe, expect, it } from 'vitest'
import { mergeProductionOrderEditableItems, type ProductionOrderEditableItem } from './recipes'

describe('mergeProductionOrderEditableItems manual rows', () => {
  it('preserves manually added rows when recipe items are recalculated', () => {
    const manual: ProductionOrderEditableItem = {
      key: 'manual-1',
      itemType: 'manual',
      sortOrder: 2,
      productionCode: 'TEMP-001',
      materialName: 'Temporary Material',
      percentage: 5,
      requiredWeight: 5,
      actualWeight: 4.8,
      notes: 'urgent sample',
    }

    const result = mergeProductionOrderEditableItems([], 200, [manual])

    expect(result).toEqual([{
      ...manual,
      requiredWeight: 10,
    }])
  })
})
