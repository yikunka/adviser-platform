import { describe, expect, it } from 'vitest'
import PizZip from 'pizzip'
import { fillBracketPlaceholders, fillDocxTemplate } from './fill-docx'
import { integerToWords } from './number-words'
import { naturalPersonNameSurnameFirst } from './person-name'
import { resolveShareTransferTemplate, shareTransferPlaceholders, type ShareTransferInput } from './share-transfer'

describe('share transfer document fill', () => {
  it('puts a natural person surname first', () => {
    expect(naturalPersonNameSurnameFirst({
      firstName: 'Yibing',
      lastName: 'LU',
      nameEn: 'Yibing LU',
    })).toBe('LU Yibing')
    expect(naturalPersonNameSurnameFirst({ nameEn: '6AM Technology Limited' })).toBe('6AM Technology Limited')
  })

  it('writes English share counts', () => {
    expect(integerToWords(1)).toBe('ONE')
    expect(integerToWords(21)).toBe('TWENTY-ONE')
    expect(integerToWords(100)).toBe('ONE HUNDRED')
    expect(integerToWords(101)).toBe('ONE HUNDRED AND ONE')
    expect(integerToWords(2510)).toBe('TWO THOUSAND FIVE HUNDRED AND TEN')
  })

  it('underlines a filled value without underlining the label', () => {
    const xml = '<w:r><w:rPr><w:b/></w:rPr><w:t>HK$[Amount] Only</w:t></w:r>'
    const filled = fillBracketPlaceholders(xml, { '[Amount]': '100' }, { underline: true })
    expect(filled).toContain('>HK$</w:t>')
    expect(filled).toContain('>100</w:t>')
    expect(filled).toContain('> Only</w:t>')
    expect(filled.match(/<w:u w:val="single"\/>/g)).toHaveLength(1)
    expect(filled).toContain('<w:b/>')
  })

  it('fills repeated tokens and leaves witness blanks', () => {
    const xml = '[Company Name (English)] / [Occupation] / [Occupation] / Witness name: [Name]'
    const filled = fillBracketPlaceholders(xml, {
      '[Company Name (English)]': 'Alpha & Beta Limited',
      '[Occupation]': ['Buyer', 'Seller'],
    })
    expect(filled).toBe('Alpha &amp; Beta Limited / Buyer / Seller / Witness name: [Name]')
  })

  it('maps a share transfer onto the template tokens', () => {
    const values = shareTransferPlaceholders({
      companyNameEn: 'Example Limited',
      companyNameZh: '例子有限公司',
      brNo: '12345678',
      companyNo: '7654321',
      transferDate: '2026-05-18',
      transferor: { name: 'Ada Chan', address: '1 Road', occupation: 'Merchant' },
      transferee: { name: 'Ben Lee', address: '2 Road', occupation: 'Director' },
      numberOfShares: 100,
      shareClass: 'Ordinary',
      parValue: '1.00',
      consideration: '100.00',
      shareNumbers: '1-100',
      oldCertNo: '1',
      newCertNo: '2',
      directorName: 'Cara Wong',
      paidStatus: 'Fully paid',
      paidAmount: '',
      useCommonSeal: false,
      documents: ['instrument'],
    })
    expect(values['[Date]']).toBe('18 May 2026')
    expect(values['[Number in words]']).toBe('ONE HUNDRED')
    expect(values['[Occupation]']).toEqual(['Director', 'Merchant'])
    expect(values['[Paid Amount]']).toBe('100.00')
    expect(values['[the Common Seal of the Company / the hand(s) of the authorised signatories]'])
      .toBe('the hand(s) of the authorised signatories')
  })

  it('fills the instrument of transfer template and leaves witness lines', async () => {
    const input: ShareTransferInput = {
      companyNameEn: 'Example Limited',
      companyNameZh: '',
      brNo: '',
      companyNo: '',
      transferDate: '2026-05-18',
      transferor: { name: 'Ada Chan', address: '1 Road', occupation: 'Merchant' },
      transferee: { name: 'Ben Lee', address: '2 Road', occupation: 'Director' },
      numberOfShares: 100,
      shareClass: 'Ordinary',
      parValue: '1.00',
      consideration: '100.00',
      shareNumbers: '1-100',
      oldCertNo: '1',
      newCertNo: '2',
      directorName: 'Cara Wong',
      paidStatus: 'Fully paid',
      paidAmount: '',
      useCommonSeal: false,
      documents: ['instrument'],
    }
    const templatePath = await resolveShareTransferTemplate('Instrument of Transfer.docx')
    const buffer = await fillDocxTemplate(templatePath, shareTransferPlaceholders(input))
    const xml = new PizZip(buffer).file('word/document.xml').asText() as string
    expect(xml).toContain('Example Limited')
    expect(xml).toContain('Ada Chan')
    expect(xml).toContain('Ben Lee')
    expect(xml).not.toContain('[Company Name (English)]')
    expect(xml).not.toContain('[Transferor Name]')
    expect(xml).not.toContain('Witness address')
    expect(xml).not.toContain('[Address]')
    expect(xml).toContain('Witness name:')
    expect(xml).not.toContain('[Name]')
    const paragraphs = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(match => match[0])
    for (const name of ['Ada Chan', 'Ben Lee']) {
      const signature = paragraphs.find(paragraph => {
        const text = [...paragraph.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(match => match[1]).join('')
        return text === name
      })
      expect(signature, `${name} signature line`).toBeTruthy()
      expect(signature).toContain('<w:jc w:val="center"/>')
    }
  })
})
