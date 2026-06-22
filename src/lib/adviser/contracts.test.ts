import { describe, expect, it } from 'vitest'
import { resolveAdviserContractContentType, validateAdviserContractFile } from './contracts'

function file(name: string, type: string, size = 1024) {
  return new File(['x'.repeat(size)], name, { type })
}

describe('Adviser contract files', () => {
  it('accepts PDF, Word, and image contract files up to 10MB', () => {
    expect(resolveAdviserContractContentType(file('服务合同.pdf', ''))).toBe('application/pdf')
    expect(resolveAdviserContractContentType(file('agreement.docx', ''))).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(validateAdviserContractFile(file('scan.webp', 'image/webp'))).toBeNull()
  })

  it('rejects unsupported or oversized contract files', () => {
    expect(validateAdviserContractFile(file('contract.txt', 'text/plain'))).toContain('不支持')
    expect(validateAdviserContractFile(file('contract.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toContain('10 MB')
  })
})
