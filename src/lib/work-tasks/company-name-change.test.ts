import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import PizZip from 'pizzip'
import { applyShareholderSignatures, renderCompanyNameChangeDocument } from './company-name-change'
import { nnc2Brn, nnc2LanguageName, nnc2Values, renderNnc2 } from './nnc2'

function documentText(buffer: Buffer): string {
  const xml = new PizZip(buffer).file('word/document.xml')?.asText() ?? ''
  return xml.replace(/<[^>]+>/g, '')
}

const input = {
  companyNameEn: '6AM Technology Limited',
  companyNameZh: '',
  companyNo: '75549235',
  brn: '',
  newCompanyNameEn: '6AM Technical (HK) Limited',
  newCompanyNameZh: '',
  changeDate: '2026-09-20',
  shareholderNames: [] as string[],
  signatoryName: '',
  signatoryCapacity: 'DIRECTOR' as const,
  signatoryDate: '2026-09-20',
  presentorNameZh: '',
  presentorNameEn: '',
  presentorAddress: '',
  presentorTel: '',
  presentorFax: '',
  presentorEmail: '',
  presentorReference: '',
}

describe('company name change signatures', () => {
  it('keeps one signature block for one shareholder', async () => {
    const buffer = (await renderCompanyNameChangeDocument({
      ...input,
      shareholderNames: ['6AM Technology Limited', '', '', ''],
    })).buffer
    const text = documentText(buffer)
    expect(text.match(/\(Shareholder\)/g)).toHaveLength(1)
    expect(text).toContain('6AM Technology Limited')
    expect(text).not.toContain('[Shareholder Name')
    expect(text).not.toContain('""')
    const xml = new PizZip(buffer).file('word/document.xml')?.asText() ?? ''
    const beforeTable = xml.slice(0, xml.indexOf('<w:tbl>'))
    expect(beforeTable.match(/<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"\/><\/w:pPr><\/w:p>/g)).toHaveLength(3)
  })

  it('prints a Chinese name and omits the quoted line when that name is blank', async () => {
    const named = documentText((await renderCompanyNameChangeDocument({
      ...input,
      companyNameZh: '六时有限公司',
      newCompanyNameZh: '六时技术有限公司',
      shareholderNames: ['6AM Technology Limited'],
    })).buffer)
    expect(named).toContain('六时有限公司')
    expect(named).toContain('"六时技术有限公司"')

    const blank = documentText((await renderCompanyNameChangeDocument({
      ...input,
      companyNameZh: '',
      newCompanyNameZh: '',
      newCompanyNameEn: '6AM Technical (HK) Limited',
      shareholderNames: ['6AM Technology Limited'],
    })).buffer)
    expect(blank).toContain('"6AM Technical (HK) Limited"')
    expect(blank).not.toContain('""')
    expect(blank).not.toContain('[Company Name (Chinese)]')
    expect(blank).not.toContain('[New Company Name (Chinese)]')
  })

  it('omits the signature block when no shareholder is named', async () => {
    const buffer = (await renderCompanyNameChangeDocument(input)).buffer
    const text = documentText(buffer)
    expect(text).not.toContain('(Shareholder)')
    expect(text).not.toContain('_______________________________')
    expect(text).not.toContain('[Shareholder Name')
  })

  it('drops blank slots and keeps the named shareholders in order', async () => {
    const xml = await readFile(path.join(process.cwd(), 'assets/secretarial/company-name-change/Special Resolution - Change of Company Name.docx'))
    const source = new PizZip(xml).file('word/document.xml')?.asText() ?? ''
    const next = applyShareholderSignatures(source, ['Alpha', ' ', 'Beta'])
    const text = next.replace(/<[^>]+>/g, '')
    expect(text.match(/\(Shareholder\)/g)).toHaveLength(2)
    expect(text.indexOf('Alpha')).toBeLessThan(text.indexOf('Beta'))
    expect(text).not.toContain('[Shareholder Name')
  })
})

describe('form NNC2', () => {
  it('keeps a language that is not being changed and writes NIL when that language does not exist', () => {
    expect(nnc2LanguageName('', '六时有限公司')).toBe('六时有限公司')
    expect(nnc2LanguageName('New Limited', 'Old Limited')).toBe('New Limited')
    expect(nnc2LanguageName('', '')).toBe('NIL')
    expect(nnc2Brn('75549235-000-00-00-0')).toBe('75549235')
  })

  it('fills the company name, resolution date, and strikes the unused capacity', async () => {
    const values = nnc2Values({
      ...input,
      companyNameZh: '六时有限公司',
      brn: '75549235-000',
      newCompanyNameZh: '',
      signatoryName: 'Chan Tai Man',
      signatoryCapacity: 'DIRECTOR',
      presentorNameEn: '6AM Advisory Limited',
    })
    expect(values.existingNameZh).toBe('六时有限公司')
    expect(values.intendedNameZh).toBe('六时有限公司')
    expect(values.intendedNameEn).toBe('6AM Technical (HK) Limited')
    expect(values.brn).toBe('75549235')
    expect(values.resolutionDay).toBe('20')
    const buffer = await renderNnc2({
      ...input,
      companyNameZh: '六时有限公司',
      brn: '75549235-000',
      signatoryName: 'Chan Tai Man',
      signatoryCapacity: 'DIRECTOR',
      presentorNameEn: '6AM Advisory Limited',
    })
    const { PDFDocument } = await import('pdf-lib')
    const { inflateSync } = await import('node:zlib')
    const doc = await PDFDocument.load(buffer)
    expect(doc.getForm().getFields()).toHaveLength(0)
    const streams = buffer.toString('latin1').split('stream')
    const text = streams.map(part => {
      const body = part.split('endstream')[0]?.replace(/^\r?\n/, '')
      if (!body) return ''
      try { return inflateSync(Buffer.from(body, 'latin1')).toString('latin1') } catch { return '' }
    }).join('\n')
    expect(text).toContain('0 0 0 rg')
  })
})
