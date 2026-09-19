import { describe, expect, it } from 'vitest'
import {
  SFS_DESIGN_IMAGE_CATEGORIES,
  SFS_SPEC_CATEGORIES,
  defaultChainLengthForSettingType,
  getDefaultSfsOrderSpecOptions,
  getDesignOptionGroupsForSettingType,
  getDesignOptionsForSettingType,
} from './diamond-spec-options'

describe('SFS diamond design options', () => {
  it('exposes source options before color with image and additive pricing support', () => {
    const options = getDefaultSfsOrderSpecOptions()

    expect(SFS_SPEC_CATEGORIES.slice(0, 2)).toEqual(['SOURCE', 'COLOR'])
    expect(SFS_DESIGN_IMAGE_CATEGORIES.has('SOURCE')).toBe(true)
    expect(SFS_DESIGN_IMAGE_CATEGORIES.has('CARAT')).toBe(true)
    expect(options.sources.map(option => option.value)).toEqual(['Hairs', 'Ashes', 'Mix'])
  })

  it('shows only earring design options under earring', () => {
    const options = getDefaultSfsOrderSpecOptions()
    const groups = getDesignOptionGroupsForSettingType('Earring', options)

    expect(groups.map(group => group.label)).toEqual(['Earring Design'])
    expect(groups[0]?.options.map(option => option.value)).toEqual(['Stud', 'Drop', 'Hoop'])
  })

  it('prefills a shared bracelet length before a design is chosen', () => {
    const options = getDefaultSfsOrderSpecOptions()
    options.braceletDesigns = options.braceletDesigns.map(option => ({ ...option, chainLength: '18' }))
    expect(defaultChainLengthForSettingType('Bracelet', options)).toBe('18')
    expect(defaultChainLengthForSettingType('Bracelet', options, 'Tennis')).toBe('18')
    options.braceletDesigns[0] = { ...options.braceletDesigns[0], chainLength: '16' }
    expect(defaultChainLengthForSettingType('Bracelet', options)).toBe('')
    expect(defaultChainLengthForSettingType('Bracelet', options, 'Tennis')).toBe('16')
  })

  it('does not accept bracelet design values for earring validation through flattened design options', () => {
    const options = getDefaultSfsOrderSpecOptions()
    expect(getDesignOptionsForSettingType('Earring', options).map(option => option.value)).not.toContain('Tennis')
  })
})
