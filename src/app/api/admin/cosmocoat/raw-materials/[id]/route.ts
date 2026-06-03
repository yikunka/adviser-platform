import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { serializeRawMaterial } from '@/lib/cosmocoat/raw-materials'
import { refreshRecipeCostsForRawMaterials } from '@/lib/cosmocoat/recipe-cost-refresh'

const ynSchema = z.union([z.literal(''), z.literal('Y'), z.literal('N')])

const patchSchema = z.object({
  category: z.string().trim().min(1).max(64).optional(),
  attributeCode: z.string().trim().min(1).max(16).optional(),
  productionCode: z.string().trim().min(1).max(32).optional(),
  huaxingCode: z.string().trim().max(32).optional(),
  name: z.string().trim().min(1).max(500).optional(),
  primarySupplierCode: z.string().trim().max(32).optional(),
  primarySupplierName: z.string().trim().max(200).optional(),
  primaryPackageKg: z.number().min(0).nullable().optional(),
  primaryPricePerKg: z.number().min(0).nullable().optional(),
  primaryTaxIncluded: ynSchema.optional(),
  primaryFreightIncluded: ynSchema.optional(),
  primaryNotes: z.string().trim().max(500).optional(),
  secondarySupplierCode: z.string().trim().max(32).optional(),
  secondarySupplierName: z.string().trim().max(200).optional(),
  secondaryPackageKg: z.number().min(0).nullable().optional(),
  secondaryPricePerKg: z.number().min(0).nullable().optional(),
  secondaryTaxIncluded: ynSchema.optional(),
  secondaryFreightIncluded: ynSchema.optional(),
  secondaryNotes: z.string().trim().max(500).optional(),
})

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

function decimalChanged(current: unknown, next: number | null | undefined): boolean {
  if (next === undefined) return false
  const currentNumber = current == null ? null : Number(current)
  if (currentNumber === null || next === null) return currentNumber !== next
  return Math.abs(currentNumber - next) > 1e-9
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableRawMaterial.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: '原料不存在' }, { status: 404 })
  }

  return NextResponse.json({ item: serializeRawMaterial(current) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.cosTableRawMaterial.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '原料不存在' }, { status: 404 })

  if (parsed.data.productionCode && parsed.data.productionCode !== current.productionCode) {
    const conflict = await prisma.cosTableRawMaterial.findUnique({
      where: { productionCode: parsed.data.productionCode },
    })
    if (conflict) return NextResponse.json({ error: '生产号已存在' }, { status: 409 })
  }

  try {
    let costRefresh: Awaited<ReturnType<typeof refreshRecipeCostsForRawMaterials>> | null = null
    const item = await prisma.$transaction(async tx => {
      const updated = await tx.cosTableRawMaterial.update({
        where: { id },
        data: parsed.data,
      })

      if (decimalChanged(current.primaryPricePerKg, parsed.data.primaryPricePerKg)) {
        costRefresh = await refreshRecipeCostsForRawMaterials([id], tx)
      }

      return updated
    })
    return NextResponse.json({ item: serializeRawMaterial(item), costRefresh })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '原料表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatRawMaterials' })
  if (error) return error

  const { id } = await params
  const current = await prisma.cosTableRawMaterial.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: '原料不存在' }, { status: 404 })

  await prisma.cosTableRawMaterial.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
