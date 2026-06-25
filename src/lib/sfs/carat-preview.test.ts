import { describe, expect, it } from 'vitest'
import { getCaratPreviewDiameter } from './carat-preview'

describe('getCaratPreviewDiameter', () => {
  it('scales thumbnail diameters upward as carat values increase', () => {
    expect(getCaratPreviewDiameter('0.5')).toBeLessThan(getCaratPreviewDiameter('1.0'))
    expect(getCaratPreviewDiameter('1.0')).toBeLessThan(getCaratPreviewDiameter('2.0'))
    expect(getCaratPreviewDiameter('2.0')).toBeLessThan(getCaratPreviewDiameter('3.0'))
  })

  it('falls back to a medium preview size for invalid carat values', () => {
    expect(getCaratPreviewDiameter('custom')).toBe(40)
  })
})
