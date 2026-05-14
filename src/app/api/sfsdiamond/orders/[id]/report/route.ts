import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, PDFImage, StandardFonts, rgb } from 'pdf-lib'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { readLocalFile } from '@/lib/storage/r2'

const ADMIN_ROLES = new Set(['STAFF', 'COMPLIANCE', 'SUPER_ADMIN'])

const PHASE_LABELS: Record<string, string> = {
  CHEM_TRANSFORM: 'Chemical Transformation',
  CVD:            'CVD Growth',
  CRAFTING:       'Crafting & Jewelry Setting',
}
const PHASE_ORDER = ['CHEM_TRANSFORM', 'CVD', 'CRAFTING']

// Strip non-WinAnsi characters so pdf-lib StandardFonts never throw
function safe(s: string | null | undefined): string {
  if (!s) return '-'
  return s
    .replace(/[—–]/g, '-')
    .replace(/·/g, '.')
    .replace(/[^\x00-\xFF]/g, '?')
}

function fmt(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDt(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('en-HK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Try to embed a file as a PDF image; returns null for unsupported types (webp, pdf, etc.)
async function tryEmbedImage(doc: PDFDocument, key: string): Promise<PDFImage | null> {
  const ext = path.extname(key).slice(1).toLowerCase()
  if (ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png') return null
  try {
    const { buffer } = await readLocalFile(key)
    return ext === 'png' ? doc.embedPng(buffer) : doc.embedJpg(buffer)
  } catch {
    return null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const isAdmin = ADMIN_ROLES.has(session.user.role)

  const order = await prisma.sfsOrder.findUnique({
    where: { id },
    include: { steps: { orderBy: [{ phase: 'asc' }, { stepNumber: 'asc' }] } },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Report is only available for completed orders' }, { status: 403 })
  }

  const diamonds = order.diamonds as {
    code?: string; carat?: string; shape?: string; type?: string
    design?: string; metal?: string; ringSize?: string
  }[]

  // Pre-load all step images in parallel so we don't block during PDF layout
  const stepImageMap = new Map<string, (PDFImage | null)[]>()

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const doc  = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await doc.embedFont(StandardFonts.Helvetica)

  // Embed all images now (doc must exist first)
  await Promise.all(
    order.steps.map(async step => {
      const images = await Promise.all(step.fileKeys.map(k => tryEmbedImage(doc, k)))
      stepImageMap.set(step.id, images)
    }),
  )

  const W  = 595
  const H  = 842
  const ML = 50
  const MR = 50
  const CW = W - ML - MR

  const GOLD  = rgb(0.788, 0.663, 0.431)
  const BLACK = rgb(0.1,   0.1,   0.1)
  const GREY  = rgb(0.42,  0.37,  0.29)
  const LGREY = rgb(0.93,  0.91,  0.88)

  let page = doc.addPage([W, H])
  let y    = H - 48

  function ensureSpace(need: number) {
    if (y - need < 48) {
      page = doc.addPage([W, H])
      y = H - 48
    }
  }

  function drawLine(thickness = 0.5, color = LGREY) {
    page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness, color })
    y -= 10
  }

  function drawText(
    text: string,
    opts: { size?: number; font?: typeof bold; color?: ReturnType<typeof rgb>; x?: number; indent?: number } = {},
  ) {
    const { size = 9, font = reg, color = BLACK, x, indent = 0 } = opts
    const px   = x ?? ML + indent
    const maxW = CW - indent - (x != null ? Math.max(0, x - ML) : 0)
    const words = safe(text).split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        ensureSpace(size + 4)
        page.drawText(line, { x: px, y, size, font, color })
        y -= size + 4
        line = word
      } else {
        line = test
      }
    }
    if (line) {
      ensureSpace(size + 4)
      page.drawText(line, { x: px, y, size, font, color })
      y -= size + 4
    }
  }

  function drawKV(label: string, value: string) {
    const labelStr = `${label}: `
    const lw = bold.widthOfTextAtSize(labelStr, 9)
    ensureSpace(14)
    page.drawText(labelStr, { x: ML, y, size: 9, font: bold, color: GREY })
    const px   = ML + lw
    const maxW = CW - lw
    const words = safe(value).split(' ')
    let line = ''
    let firstLine = true
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (reg.widthOfTextAtSize(test, 9) > maxW && line) {
        page.drawText(line, { x: firstLine ? px : ML + 12, y, size: 9, font: reg, color: BLACK })
        y -= 13
        ensureSpace(13)
        line = word
        firstLine = false
      } else {
        line = test
      }
    }
    if (line) {
      page.drawText(line, { x: firstLine ? px : ML + 12, y, size: 9, font: reg, color: BLACK })
    }
    y -= 13
  }

  // Like drawKV but indented (used inside list items)
  function drawKVIndented(label: string, value: string, indent = 16) {
    const labelStr = `${label}: `
    const lw = bold.widthOfTextAtSize(labelStr, 9)
    ensureSpace(14)
    page.drawText(labelStr, { x: ML + indent, y, size: 9, font: bold, color: GREY })
    const px   = ML + indent + lw
    const maxW = CW - indent - lw
    const words = safe(value).split(' ')
    let line = ''
    let firstLine = true
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (reg.widthOfTextAtSize(test, 9) > maxW && line) {
        page.drawText(line, { x: firstLine ? px : ML + indent + 8, y, size: 9, font: reg, color: BLACK })
        y -= 13
        ensureSpace(13)
        line = word
        firstLine = false
      } else {
        line = test
      }
    }
    if (line) {
      page.drawText(line, { x: firstLine ? px : ML + indent + 8, y, size: 9, font: reg, color: BLACK })
    }
    y -= 13
  }

  function sectionHeader(title: string) {
    ensureSpace(30)
    y -= 8
    page.drawRectangle({ x: ML, y: y - 4, width: CW, height: 20, color: LGREY })
    page.drawText(title.toUpperCase(), { x: ML + 6, y: y + 3, size: 8, font: bold, color: GREY })
    y -= 20
  }

  // ── Header ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: GOLD })
  page.drawText('SFS DIAMOND', { x: ML, y, size: 22, font: bold, color: GOLD })
  y -= 28
  page.drawText('Memorial Diamond Production Report', { x: ML, y, size: 12, font: reg, color: BLACK })
  y -= 20
  if (order.sampleCode) {
    page.drawText(safe(order.sampleCode), { x: ML, y, size: 18, font: bold, color: GOLD })
    y -= 22
  }
  page.drawText(`Generated: ${safe(fmtDt(new Date()))}`, { x: ML, y, size: 8, font: reg, color: GREY })
  y -= 6
  drawLine(1, GOLD)

  // ── Order Information ─────────────────────────────────────────────────────
  sectionHeader('Order Information')
  if (order.sampleCode) drawKV('Sample Code',  order.sampleCode)
  drawKV('Memorial Name', order.memorialName)
  drawKV('Relationship',  order.relationship ?? '-')
  drawKV('Status',        order.status)
  drawKV('Order Date',    fmt(order.date ? new Date(order.date) : order.createdAt))
  y -= 4

  sectionHeader('Client Details')
  drawKV('Client Name',     order.clientName)
  drawKV('Contact Number',  order.contactNumber)
  drawKV('Email',           order.email)
  drawKV('Mailing Address', order.mailingAddress)
  drawKV('Source Type',     order.sourceType + (order.sourceOther ? ` - ${order.sourceOther}` : ''))
  drawKV('Diamond Color',   order.color)
  if (order.remarks) drawKV('Remarks', order.remarks)
  y -= 4

  // ── Diamonds ─────────────────────────────────────────────────────────────
  sectionHeader(`Diamonds (${diamonds.length})`)
  diamonds.forEach((d, i) => {
    ensureSpace(70)
    const num = i + 1
    page.drawText(`${num}.`, { x: ML + 4, y, size: 10, font: bold, color: BLACK })
    y -= 14
    if (d.code) drawKVIndented('Diamond Code', d.code)
    const summary = [d.carat && `${d.carat} ct`, d.shape, d.type].filter(Boolean).map(safe).join(', ')
    if (summary) drawKVIndented('Specification', summary)
    const extras = [d.design, d.metal].filter(Boolean).map(safe).join(', ')
    if (extras) drawKVIndented('Design / Metal', extras)
    if (d.ringSize) drawKVIndented('Ring Size (EU)', d.ringSize)
    y -= 4
  })

  // ── Milestone Dates ───────────────────────────────────────────────────────
  const milestones: [string, Date | string | null | undefined][] = [
    ['Sample Received',       order.sampleReceivedAt],
    ['Chem. Transform Start', order.chemTransformStartAt],
    ['Chem. Transform End',   order.chemTransformEndAt],
    ['CVD Start',             order.cvdStartAt],
    ['CVD Expected End',      order.cvdExpectedEndAt],
    ['CVD End',               order.cvdEndAt],
    ['Crafting Start',        order.craftingStartAt],
    ['Crafting End',          order.craftingEndAt],
    ['IGI Certification',     order.igiCertificationAt],
    ['Jewelry Setting Start', order.jewelrySettingStartAt],
    ['Jewelry Setting End',   order.jewelrySettingEndAt],
    ['Packaging',             order.packagingAt],
    ['Delivery',              order.deliveryAt],
  ]
  const hasMilestones = milestones.some(([, v]) => v)
  if (hasMilestones) {
    sectionHeader('Milestone Dates')
    milestones.forEach(([label, val]) => { if (val) drawKV(label, fmtDt(val)) })
    if (order.deliveryDetails) drawKV('Delivery Details', order.deliveryDetails)
    y -= 4
  }

  // ── Production Steps ──────────────────────────────────────────────────────
  sectionHeader('Production Progress')

  if (order.steps.length === 0) {
    drawText('No production steps recorded.', { color: GREY })
  } else {
    for (const phase of PHASE_ORDER) {
      const phaseSteps = order.steps.filter(s => s.phase === phase)
      if (phaseSteps.length === 0) continue

      ensureSpace(26)
      y -= 4
      page.drawText(safe(PHASE_LABELS[phase] ?? phase), { x: ML, y, size: 10, font: bold, color: BLACK })
      y -= 14

      for (const step of phaseSteps) {
        ensureSpace(32)
        // Gold bullet square
        page.drawRectangle({ x: ML + 4, y: y - 1, width: 6, height: 6, color: GOLD })
        page.drawText(`Step ${step.stepNumber}  ${safe(step.particular)}`, {
          x: ML + 16, y, size: 9, font: bold, color: BLACK,
        })
        y -= 13
        drawText(safe(fmtDt(step.recordedAt)), { indent: 16, size: 8, color: GREY })
        if (step.notes) drawText(safe(step.notes), { indent: 16, size: 8, color: GREY })

        // ── Files: show name + embed image if supported ──────────────────
        if (step.fileKeys.length > 0) {
          const images = stepImageMap.get(step.id) ?? []

          for (let fi = 0; fi < step.fileKeys.length; fi++) {
            const key      = step.fileKeys[fi]
            const fileName = path.basename(key)
            const img      = images[fi]

            // Always show the filename
            ensureSpace(14)
            page.drawText(`[${fi + 1}] ${safe(fileName)}`, {
              x: ML + 16, y, size: 8, font: reg, color: GREY,
            })
            y -= 12

            // Embed image if it was loaded successfully
            if (img) {
              const dims  = img.scale(1)
              const maxW  = CW - 24          // indent 24 from margin
              const maxH  = 220
              const scale = Math.min(maxW / dims.width, maxH / dims.height, 1)
              const iw    = dims.width  * scale
              const ih    = dims.height * scale

              ensureSpace(ih + 10)
              page.drawImage(img, {
                x:      ML + 16,
                y:      y - ih,
                width:  iw,
                height: ih,
              })
              y -= ih + 8
            }
          }
        }

        y -= 6
      }
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: GOLD })
    p.drawText(`SFS Diamond  |  Page ${i + 1} of ${pages.length}`, {
      x: ML, y: 14, size: 7, font: reg, color: GREY,
    })
  })

  const bytes    = await doc.save()
  const filename = `SFSDiamond_${safe(order.sampleCode ?? order.id)}.pdf`

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
