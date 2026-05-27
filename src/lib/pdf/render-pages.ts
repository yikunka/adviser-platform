import { execFile } from 'child_process'
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'
import { PDFDocument } from 'pdf-lib'

export type RenderedPdfPage = {
  mimeType: 'image/png'
  base64: string
  label: string
}

const execFileAsync = promisify(execFile)

const PDFTOPPM_CANDIDATES = [
  process.env['PDFTOPPM_PATH'] ?? '',
  'pdftoppm',
  '/opt/homebrew/bin/pdftoppm',
  '/usr/local/bin/pdftoppm',
  '/usr/bin/pdftoppm',
].filter(Boolean)

type RenderPdfPagesOptions = {
  maxPages?: number
  dpi?: number
  logPrefix?: string
}

export async function renderPdfPages(
  buffer: Buffer,
  fileName: string,
  options?: RenderPdfPagesOptions,
): Promise<RenderedPdfPage[]> {
  const maxPages = options?.maxPages ?? 5
  const dpi = options?.dpi ?? 160
  const logPrefix = options?.logPrefix ?? '[pdf/render-pages]'
  const dir = await mkdtemp(path.join(tmpdir(), 'pdf-render-'))
  const inputPath = path.join(dir, 'input.pdf')
  const outputPrefix = path.join(dir, 'page')

  try {
    await writeFile(inputPath, buffer)

    if (await renderWithPdftoppm(inputPath, outputPrefix, maxPages, dpi, logPrefix)) {
      const pages = await collectRenderedPages(dir, maxPages)
      if (pages.length > 0) return pages
    }

    // macOS Quick Look only renders the first page of a multi-page PDF — split first.
    if (process.platform === 'darwin') {
      const splitPages = await renderWithSplitQuickLook(buffer, dir, maxPages, logPrefix)
      if (splitPages.length > 0) return splitPages
    }

    if (await renderWithQuickLook(inputPath, dir, logPrefix)) {
      const pages = await collectRenderedPages(dir, 1)
      if (pages.length > 0) return pages
    }

    console.warn(
      `${logPrefix} PDF image render skipped for ${fileName}: no PDF renderer found. ` +
      'Install poppler-utils (Linux: apt-get install -y poppler-utils) or set PDFTOPPM_PATH.',
    )
    return []
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function collectRenderedPages(dir: string, maxPages: number): Promise<RenderedPdfPage[]> {
  const names = (await readdir(dir))
    .filter(name => /^page-\d+\.png$/.test(name) || /^page-\d+\.pdf\.png$/.test(name) || name === 'input.pdf.png')
    .sort((a, b) => pageNumber(a) - pageNumber(b))
    .slice(0, maxPages)

  return Promise.all(names.map(async (name, index) => ({
    mimeType: 'image/png' as const,
    base64: (await readFile(path.join(dir, name))).toString('base64'),
    label: `page ${index + 1}`,
  })))
}

async function renderWithPdftoppm(
  inputPath: string,
  outputPrefix: string,
  maxPages: number,
  dpi: number,
  logPrefix: string,
) {
  const args = ['-png', '-f', '1', '-l', String(maxPages), '-r', String(dpi), inputPath, outputPrefix]

  for (const command of PDFTOPPM_CANDIDATES) {
    try {
      if (command.includes('/')) await access(command)
      await execFileAsync(command, args, { timeout: 60000, maxBuffer: 20 * 1024 * 1024 })
      return true
    } catch (error) {
      if (!isMissingCommandError(error)) {
        console.warn(`${logPrefix} pdftoppm failed at ${command}:`, error)
        return false
      }
    }
  }

  return false
}

async function renderWithQuickLook(inputPath: string, outputDir: string, logPrefix: string) {
  try {
    await access('/usr/bin/qlmanage')
    await execFileAsync('/usr/bin/qlmanage', ['-t', '-s', '1600', '-o', outputDir, inputPath], {
      timeout: 60000,
      maxBuffer: 20 * 1024 * 1024,
    })
    return true
  } catch (error) {
    if (!isMissingCommandError(error)) {
      console.warn(`${logPrefix} qlmanage PDF render failed:`, error)
    }
    return false
  }
}

async function renderWithSplitQuickLook(
  buffer: Buffer,
  dir: string,
  maxPages: number,
  logPrefix: string,
): Promise<RenderedPdfPage[]> {
  try {
    await access('/usr/bin/qlmanage')
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pageCount = Math.min(source.getPageCount(), maxPages)
    const pages: RenderedPdfPage[] = []

    for (let i = 0; i < pageCount; i++) {
      const single = await PDFDocument.create()
      const [copied] = await single.copyPages(source, [i])
      single.addPage(copied)
      const pagePath = path.join(dir, `split-${i + 1}.pdf`)
      await writeFile(pagePath, await single.save())
      await execFileAsync('/usr/bin/qlmanage', ['-t', '-s', '1600', '-o', dir, pagePath], {
        timeout: 60000,
        maxBuffer: 20 * 1024 * 1024,
      })

      const pngName = `split-${i + 1}.pdf.png`
      const pngPath = path.join(dir, pngName)
      try {
        await access(pngPath)
        pages.push({
          mimeType: 'image/png',
          base64: (await readFile(pngPath)).toString('base64'),
          label: `page ${i + 1}`,
        })
      } catch {
        console.warn(`${logPrefix} qlmanage did not produce ${pngName}`)
      }
    }

    return pages
  } catch (error) {
    console.warn(`${logPrefix} split Quick Look render failed:`, error)
    return []
  }
}

function isMissingCommandError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ENOENT'
}

function pageNumber(fileName: string) {
  const splitMatch = fileName.match(/^split-(\d+)\.pdf\.png$/)
  if (splitMatch) return Number(splitMatch[1])
  if (fileName === 'input.pdf.png') return 1
  const pageMatch = fileName.match(/^page-(\d+)\.png$/)
  if (pageMatch) return Number(pageMatch[1])
  const pagePdfMatch = fileName.match(/^page-(\d+)\.pdf\.png$/)
  if (pagePdfMatch) return Number(pagePdfMatch[1])
  return 0
}
