import { describe, expect, it } from 'vitest'
import {
  CHEMICAL_RESISTANCE_OPTIONS,
  HIGH_TEMP_HUMIDITY_SALT_SPRAY_OPTIONS,
  normalizePerformanceStandards,
} from './process-kit-standards'

describe('process kit performance standards', () => {
  it('includes perfume tests in chemical resistance options', () => {
    expect(CHEMICAL_RESISTANCE_OPTIONS.map(option => option.label)).toEqual(expect.arrayContaining([
      '香水包裹 24H',
      '香水浸泡 4H',
      '香水浸泡 8H',
    ]))
  })

  it('keeps only the four concrete high-temp humidity and salt spray options', () => {
    expect(HIGH_TEMP_HUMIDITY_SALT_SPRAY_OPTIONS.map(option => option.label)).toEqual([
      '65°C/85%RH 24H',
      '65°C/85%RH 48H',
      '5% NaCl 盐雾 24H',
      '5% NaCl 盐雾 48H',
    ])
    expect(normalizePerformanceStandards(['HIGH_TEMP_HUMIDITY_SALT_SPRAY'])).toEqual([])
  })
})
