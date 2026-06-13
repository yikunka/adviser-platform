import { describe, expect, it } from 'vitest'
import {
  extractBirthDateFromCosEmployeeIdCard,
  validateCosEmployeeIdCardNumber,
} from '@/lib/cosmocoat/employee-id-card'

describe('validateCosEmployeeIdCardNumber', () => {
  it('accepts valid 18-digit ID numbers', () => {
    expect(validateCosEmployeeIdCardNumber('110101199003079032')).toBeNull()
  })

  it('accepts valid 15-digit ID numbers', () => {
    expect(validateCosEmployeeIdCardNumber('110101900307903')).toBeNull()
  })

  it('rejects invalid checksum and format', () => {
    expect(validateCosEmployeeIdCardNumber('110101199003079031')).toBe('身份证号码校验位不正确')
    expect(validateCosEmployeeIdCardNumber('123456789012345')).toBe('请输入有效的 15 位或 18 位身份证号码')
    expect(validateCosEmployeeIdCardNumber('110101199002319030')).toBe('身份证号码中的出生日期无效')
  })
})

describe('extractBirthDateFromCosEmployeeIdCard', () => {
  it('extracts birth date from 18-digit ID numbers', () => {
    expect(extractBirthDateFromCosEmployeeIdCard('110101199003079032')).toBe('1990-03-07')
  })

  it('extracts birth date from 15-digit ID numbers', () => {
    expect(extractBirthDateFromCosEmployeeIdCard('110101900307903')).toBe('1990-03-07')
  })

  it('uses 19xx for legacy 15-digit ID birth years', () => {
    expect(extractBirthDateFromCosEmployeeIdCard('110101000101903')).toBe('1900-01-01')
  })

  it('returns null for invalid values', () => {
    expect(extractBirthDateFromCosEmployeeIdCard('')).toBeNull()
    expect(extractBirthDateFromCosEmployeeIdCard('invalid')).toBeNull()
  })
})
