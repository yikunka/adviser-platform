import { readFile } from 'node:fs/promises'
import PizZip from 'pizzip'

export type PlaceholderValue = string | readonly string[]

type FillOptions = {
  /** Underline only the text that replaced a known placeholder. */
  underline?: boolean
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function takeToken(queues: Map<string, string[]>, token: string): string | null {
  const queue = queues.get(token)
  if (!queue || queue.length === 0) return null
  return queue.length === 1 ? queue[0] : queue.shift()!
}

function withUnderline(rPr: string): string {
  if (/<w:u[\s/>]/.test(rPr)) return rPr
  if (!rPr) return '<w:rPr><w:u w:val="single"/></w:rPr>'
  return rPr.replace('</w:rPr>', '<w:u w:val="single"/></w:rPr>')
}

function runWithText(open: string, rPr: string, text: string): string {
  if (!text) return ''
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : ''
  return `${open}${rPr}<w:t${space}>${text}</w:t></w:r>`
}

function underlineFilledRuns(xml: string, queues: Map<string, string[]>): string {
  return xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, run => {
    const open = run.match(/^<w:r\b[^>]*>/)?.[0] ?? '<w:r>'
    const rPr = run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''
    const textMatch = run.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/)
    if (!textMatch || !/\[[^\[\]]+\]/.test(textMatch[1])) return run
    const parts = textMatch[1].split(/(\[[^\[\]]+\])/g).filter(part => part.length > 0)
    if (!parts.some(part => queues.has(part))) return run
    return parts.map(part => {
      const next = takeToken(queues, part)
      if (next == null) return runWithText(open, rPr, part)
      return runWithText(open, withUnderline(rPr), escapeXml(next))
    }).join('')
  })
}

/**
 * Replaces `[Placeholder]` tokens that sit in a single Word text run.
 * A string fills every copy of that token. An array fills copies in order,
 * and the last item is reused if the template has more copies than values.
 * Unknown tokens are left as printed blanks.
 */
export function fillBracketPlaceholders(
  xml: string,
  values: Record<string, PlaceholderValue>,
  options?: FillOptions,
): string {
  const queues = new Map<string, string[]>()
  for (const [token, value] of Object.entries(values)) {
    queues.set(token, Array.isArray(value) ? [...value] : [value])
  }

  const source = options?.underline ? underlineFilledRuns(xml, queues) : xml
  return source.replace(/\[[^\[\]]+\]/g, token => {
    const next = takeToken(queues, token)
    return next == null ? token : escapeXml(next)
  })
}

export async function fillDocxTemplate(
  templatePath: string,
  values: Record<string, PlaceholderValue>,
  options?: FillOptions,
): Promise<Buffer> {
  const zip = new PizZip(await readFile(templatePath))
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue
    const entry = zip.file(name)
    if (!entry) continue
    const xml = entry.asText()
    if (!xml.includes('[')) continue
    zip.file(name, fillBracketPlaceholders(xml, values, options))
  }
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}
