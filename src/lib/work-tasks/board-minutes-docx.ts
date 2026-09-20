import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import PizZip from 'pizzip'
import { fillBracketPlaceholders, type PlaceholderValue } from '@/lib/work-tasks/fill-docx'

function paragraphStart(xml: string, indexInside: number): number {
  return Math.max(xml.lastIndexOf('<w:p ', indexInside), xml.lastIndexOf('<w:p>', indexInside))
}

/** Three blank lines so there is room to sign above the line. */
function signatureSpacer(): string {
  return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>'.repeat(3)
}

function insertSpacerBefore(xml: string, token: string): string {
  const at = xml.indexOf(token)
  if (at < 0) return xml
  const paragraph = paragraphStart(xml, at)
  if (paragraph < 0) return xml
  return xml.slice(0, paragraph) + signatureSpacer() + xml.slice(paragraph)
}

function giveSignatureRoom(xml: string): string {
  const closing = '_______________________________'
  const present = '[Director Name]                                              _________________  (signature)'
  return insertSpacerBefore(insertSpacerBefore(xml, closing), present)
}

function removeParagraphContaining(xml: string, token: string): string {
  const at = xml.indexOf(token)
  if (at < 0) return xml
  const start = paragraphStart(xml, at)
  const end = xml.indexOf('</w:p>', at)
  if (start < 0 || end < 0) return xml
  return xml.slice(0, start) + xml.slice(end + '</w:p>'.length)
}

async function resolveTemplate(folder: string, fileName: string, missingMessage: string): Promise<string> {
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), 'assets/secretarial', folder, fileName),
    path.join(/* turbopackIgnore: true */ process.cwd(), 'Secretarial Template', fileName),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try the next location
    }
  }
  throw new Error(missingMessage)
}

export async function renderBoardMinutes(options: {
  folder: string
  templateFile: string
  missingMessage: string
  values: Record<string, PlaceholderValue>
  omitChineseName: boolean
}): Promise<Buffer> {
  const zip = new PizZip(await readFile(await resolveTemplate(options.folder, options.templateFile, options.missingMessage)))
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue
    const entry = zip.file(name)
    if (!entry) continue
    let xml = entry.asText()
    if (name === 'word/document.xml') {
      if (options.omitChineseName) xml = removeParagraphContaining(xml, '[Company Name (Chinese)]')
      xml = giveSignatureRoom(xml)
    }
    if (!xml.includes('[')) {
      zip.file(name, xml)
      continue
    }
    zip.file(name, fillBracketPlaceholders(xml, options.values))
  }
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}
