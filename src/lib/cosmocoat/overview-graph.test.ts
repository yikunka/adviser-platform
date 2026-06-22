import { describe, expect, it } from 'vitest'
import { buildOverviewRawMaterialWhere } from './overview-graph'

describe('buildOverviewRawMaterialWhere', () => {
  it('keeps only raw materials that are used by recipe items', () => {
    expect(buildOverviewRawMaterialWhere()).toEqual({
      recipeItems: {
        some: {},
      },
    })
  })
})
