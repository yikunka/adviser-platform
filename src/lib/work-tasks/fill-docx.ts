import { readFile } from 'node:fs/promises'
import PizZip from 'pizzip'

export type PlaceholderValue = string | readonly string[]

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
): string {
  const queues = new Map<string, string[]>()
  for (const [token, value] of Object.entries(values)) {
    queues.set(token, Array.isArray(value) ? [...value] : [value])
  }

  return xml.replace(/\[[^\[\]]+\]/g, token => {
    const queue = queues.get(token)
    if (!queue || queue.length === 0) return token
    const next = queue.length === 1 ? queue[0] : queue.shift()!
    return escapeXml(next)
  })
}

export async function fillDocxTemplate(
  templatePath: string,
  values: Record<string, PlaceholderValue>,
): Promise<Buffer> {
  const zip = new PizZip(await readFile(templatePath))
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue
    const entry = zip.file(name)
    if (!entry) continue
    const xml = entry.asText()
    if (!xml.includes('[')) continue
    zip.file(name, fillBracketPlaceholders(xml, values))
  }
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}
