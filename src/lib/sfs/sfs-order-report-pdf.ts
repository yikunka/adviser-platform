import path from 'path'
import { createHash } from 'crypto'
import { PDFDocument, PDFImage, StandardFonts, rgb } from 'pdf-lib'
import type { Prisma } from '@prisma/client'
import { readLocalFile } from '@/lib/storage/r2'
import {
  groupSfsStepFilesByDiamond,
  sfsCustomerVisibleStepFileKeys,
  sfsStepFileDiamondLabel,
  sfsStepRequiresDiamondImages,
  splitSfsStepNotes,
} from '@/lib/sfs/order-step-display'
import { SFS_PHASE_LABELS, SFS_PHASE_ORDER } from '@/lib/sfs/order-predefined-steps'

export type SfsOrderReportPayload = Prisma.SfsOrderGetPayload<{
  include: { steps: { include: { attachments: true } } }
}>

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

/** Stable fingerprint of everything that affects the PDF bytes (invalidates OSS cache). */
export function reportFingerprint(order: SfsOrderReportPayload): string {
  const steps = [...order.steps].sort(
    (a, b) =>
      a.phase.localeCompare(b.phase) ||
      a.stepNumber - b.stepNumber ||
      a.id.localeCompare(b.id),
  )
  const payload = {
    id: order.id,
    updatedAt: order.updatedAt.toISOString(),
    status: order.status,
    date: order.date,
    sampleCode: order.sampleCode,
    memorialName: order.memorialName,
    relationship: order.relationship,
    clientName: order.clientName,
    contactNumber: order.contactNumber,
    email: order.email,
    mailingAddress: order.mailingAddress,
    sourceType: order.sourceType,
    sourceOther: order.sourceOther,
    remarks: order.remarks,
    mailingPackage: order.mailingPackage,
    color: order.color,
    diamonds: order.diamonds,
    sampleReceivedAt: order.sampleReceivedAt?.toISOString() ?? null,
    chemTransformStartAt: order.chemTransformStartAt?.toISOString() ?? null,
    chemTransformEndAt: order.chemTransformEndAt?.toISOString() ?? null,
    cvdStartAt: order.cvdStartAt?.toISOString() ?? null,
    cvdExpectedEndAt: order.cvdExpectedEndAt?.toISOString() ?? null,
    cvdEndAt: order.cvdEndAt?.toISOString() ?? null,
    craftingStartAt: order.craftingStartAt?.toISOString() ?? null,
    craftingEndAt: order.craftingEndAt?.toISOString() ?? null,
    igiCertificationAt: order.igiCertificationAt?.toISOString() ?? null,
    jewelrySettingStartAt: order.jewelrySettingStartAt?.toISOString() ?? null,
    jewelrySettingEndAt: order.jewelrySettingEndAt?.toISOString() ?? null,
    packagingAt: order.packagingAt?.toISOString() ?? null,
    deliveryAt: order.deliveryAt?.toISOString() ?? null,
    deliveryDetails: order.deliveryDetails,
    adminNotes: order.adminNotes,
    customerRemark: order.customerRemark,
    steps: steps.map(s => ({
      id: s.id,
      phase: s.phase,
      stepNumber: s.stepNumber,
      recordedAt: s.recordedAt.toISOString(),
      particular: s.particular,
      notes: s.notes,
      fileKeys: sfsCustomerVisibleStepFileKeys(s),
    })),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function reportFilename(order: Pick<SfsOrderReportPayload, 'sampleCode' | 'id'>): string {
  return `SFSDiamond_${safe(order.sampleCode ?? order.id)}.pdf`
}

export async function renderSfsOrderReportPdf(order: SfsOrderReportPayload): Promise<{ bytes: Buffer; filename: string }> {
  const diamonds = order.diamonds as {
    code?: string; carat?: string; shape?: string; type?: string
    design?: string; metal?: string; ringSize?: string; chainLength?: string
  }[]

  const stepImageMap = new Map<string, (PDFImage | null)[]>()

  const doc  = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await doc.embedFont(StandardFonts.Helvetica)

  await Promise.all(
    order.steps.map(async step => {
      const images = await Promise.all(sfsCustomerVisibleStepFileKeys(step).map(k => tryEmbedImage(doc, k)))
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

  function drawStepFile(
    step: SfsOrderReportPayload['steps'][number],
    visibleFileKeys: string[],
    key: string,
    index: number,
    label?: string | null,
  ) {
    const images   = stepImageMap.get(step.id) ?? []
    const keyIndex = visibleFileKeys.indexOf(key)
    const img      = keyIndex >= 0 ? images[keyIndex] : null
    const fileName = path.basename(key)

    ensureSpace(14)
    page.drawText(`[${index + 1}] ${safe(label ? `${label} - ${fileName}` : fileName)}`, {
      x: ML + 16, y, size: 8, font: reg, color: GREY,
    })
    y -= 12

    if (img) {
      const dims  = img.scale(1)
      const maxW  = CW - 24
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

  function sectionHeader(title: string) {
    ensureSpace(30)
    y -= 8
    page.drawRectangle({ x: ML, y: y - 4, width: CW, height: 20, color: LGREY })
    page.drawText(title.toUpperCase(), { x: ML + 6, y: y + 3, size: 8, font: bold, color: GREY })
    y -= 20
  }

  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: GOLD })
  page.drawText('SFS DIAMOND', { x: ML, y, size: 22, font: bold, color: GOLD })
  y -= 28
  page.drawText('Memorial Diamond Production Report', { x: ML, y, size: 12, font: reg, color: BLACK })
  y -= 20
  if (order.sampleCode) {
    page.drawText(safe(order.sampleCode), { x: ML, y, size: 18, font: bold, color: GOLD })
    y -= 22
  }
  page.drawText(`Generated: ${safe(fmtDt(order.updatedAt))}`, { x: ML, y, size: 8, font: reg, color: GREY })
  y -= 6
  drawLine(1, GOLD)

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
    if (d.chainLength) {
      drawKVIndented(d.type === 'Bracelet' ? 'Bracelet Length' : 'Necklace Length', d.chainLength)
    }
    y -= 4
  })

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

  sectionHeader('Production Progress')

  if (order.steps.length === 0) {
    drawText('No production steps recorded.', { color: GREY })
  } else {
    for (const phase of SFS_PHASE_ORDER) {
      const phaseSteps = order.steps.filter(s => s.phase === phase)
      if (phaseSteps.length === 0) continue

      ensureSpace(26)
      y -= 4
      page.drawText(safe(SFS_PHASE_LABELS[phase] ?? phase), { x: ML, y, size: 10, font: bold, color: BLACK })
      y -= 14

      for (const step of phaseSteps) {
        ensureSpace(32)
        page.drawRectangle({ x: ML + 4, y: y - 1, width: 6, height: 6, color: GOLD })
        page.drawText(`Step ${step.stepNumber}  ${safe(step.particular)}`, {
          x: ML + 16, y, size: 9, font: bold, color: BLACK,
        })
        y -= 13
        drawText(safe(fmtDt(step.recordedAt)), { indent: 16, size: 8, color: GREY })
        const notes = splitSfsStepNotes(step.notes)
        if (notes.weight) drawText(`Weight: ${safe(notes.weight)}`, { indent: 16, size: 8, font: bold, color: GREY })
        if (notes.remark) drawText(safe(notes.remark), { indent: 16, size: 8, color: GREY })

        const visibleFileKeys = sfsCustomerVisibleStepFileKeys(step)
        if (visibleFileKeys.length > 0) {
          if (sfsStepRequiresDiamondImages(step.phase, step.stepNumber)) {
            const grouped = groupSfsStepFilesByDiamond(visibleFileKeys, diamonds)
            let fileNo = 0

            for (const group of grouped.groups) {
              ensureSpace(18)
              page.drawText(`Diamond ${safe(group.label)}`, { x: ML + 16, y, size: 8, font: bold, color: BLACK })
              y -= 12

              if (group.fileKeys.length === 0) {
                drawText('No image uploaded.', { indent: 24, size: 8, color: GREY })
              } else {
                for (const key of group.fileKeys) {
                  drawStepFile(step, visibleFileKeys, key, fileNo, group.label)
                  fileNo += 1
                }
              }
            }

            for (const key of grouped.unmatched) {
              drawStepFile(step, visibleFileKeys, key, fileNo, sfsStepFileDiamondLabel(key))
              fileNo += 1
            }
          } else {
            for (let fi = 0; fi < visibleFileKeys.length; fi++) {
              const key = visibleFileKeys[fi]
              drawStepFile(step, visibleFileKeys, key, fi, sfsStepFileDiamondLabel(key))
            }
          }
        }

        y -= 6
      }
    }
  }

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: GOLD })
    p.drawText(`SFS Diamond  |  Page ${i + 1} of ${pages.length}`, {
      x: ML, y: 14, size: 7, font: reg, color: GREY,
    })
  })

  const bytes    = await doc.save()
  const filename = reportFilename(order)

  return { bytes: Buffer.from(bytes), filename }
}
