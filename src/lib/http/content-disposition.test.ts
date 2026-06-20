import { describe, expect, it } from 'vitest'
import { contentDispositionHeader } from './content-disposition'

describe('contentDispositionHeader', () => {
  it('keeps an ASCII fallback and adds RFC 5987 UTF-8 filename for Chinese names', () => {
    expect(contentDispositionHeader('inline', '劳动合同 王小明.pdf')).toBe(
      'inline; filename="download.pdf"; filename*=UTF-8\'\'%E5%8A%B3%E5%8A%A8%E5%90%88%E5%90%8C%20%E7%8E%8B%E5%B0%8F%E6%98%8E.pdf',
    )
  })

  it('strips unsafe header characters', () => {
    expect(contentDispositionHeader('attachment', '报价"\r\n单.docx')).toBe(
      'attachment; filename="download.docx"; filename*=UTF-8\'\'%E6%8A%A5%E4%BB%B7%E5%8D%95.docx',
    )
  })
})
