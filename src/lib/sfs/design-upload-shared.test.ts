import { describe, expect, it } from 'vitest'
import {
  SFS_DESIGN_UPLOAD_MAX_SIZE,
  isSfsCustomDesign,
  isSfsDesignUploadKey,
  resolveSfsDesignContentType,
  validateSfsDesignFile,
} from './design-upload-shared'

describe('SFS design upload shared helpers', () => {
  it('accepts allowed file types by MIME type and extension', () => {
    expect(resolveSfsDesignContentType({ name: 'design.jpeg', type: '' })).toBe('image/jpeg')
    expect(resolveSfsDesignContentType({ name: 'design.any', type: 'image/webp' })).toBe('image/webp')
  })

  it('rejects invalid uploads and protects the design upload namespace', () => {
    expect(validateSfsDesignFile({ name: 'design.exe', type: 'application/octet-stream', size: 1 })).toContain('Unsupported')
    expect(validateSfsDesignFile({ name: 'design.pdf', type: 'application/pdf', size: SFS_DESIGN_UPLOAD_MAX_SIZE + 1 })).toContain('too large')
    expect(isSfsDesignUploadKey('sfs/orders/designs/a.pdf')).toBe(true)
    expect(isSfsDesignUploadKey('sfs/orders/designs/../other.pdf')).toBe(false)
    expect(isSfsCustomDesign(' Custom ')).toBe(true)
  })
})
