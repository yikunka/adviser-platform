import { describe, expect, it } from 'vitest'
import {
  SFS_DESIGN_IMAGE_CATEGORIES,
  SFS_SPEC_CATEGORIES,
  getDefaultSfsOrderSpecOptions,
  getDesignOptionGroupsForSettingType,
  getDesignOptionsForSettingType,
} from './diamond-spec-options'

describe('SFS diamond design options', () => {
  it('exposes source options before color with image and additive pricing support', () => {
    const options = getDefaultSfsOrderSpecOptions()

    expect(SFS_SPEC_CATEGORIES.slice(0, 2)).toEqual(['SOURCE', 'COLOR'])
    expect(SFS_DESIGN_IMAGE_CATEGORIES.has('SOURCE')).toBe(true)
    expect(options.sources.map(option => option.value)).toEqual(['Hairs', 'Ashes', 'Mix'])
  })

  it('shows bracelet design as an additional customer option group under earring', () => {
    const options = getDefaultSfsOrderSpecOptions()
    const groups = getDesignOptionGroupsForSettingType('Earring', options)

    expect(groups.map(group => group.label)).toEqual(['Earring Design', 'Bracelet Design'])
    expect(groups.find(group => group.label === 'Bracelet Design')?.options.map(option => option.value)).toEqual([
      'Classic',
      'Plain',
      'Tennis',
      'Chain',
    ])
  })

  it('accepts bracelet design values for earring validation through flattened design options', () => {
    const options = getDefaultSfsOrderSpecOptions()
    expect(getDesignOptionsForSettingType('Earring', options).map(option => option.value)).toContain('Tennis')
  })
})
