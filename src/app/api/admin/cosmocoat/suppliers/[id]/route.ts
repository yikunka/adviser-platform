import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  getSupplierById,
  serializeSupplier,
  supplierInclude,
} from '@/lib/cosmocoat/suppliers'
import { deleteCosSupplierFile } from '@/lib/cosmocoat/supplier-files'

const updateSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  contactPerson: z.string().trim().max(200).optional().nullable(),
  contactInfo: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  shippingAddress: z.string().trim().max(500).optional().nullable(),
})

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const { id } = await params

  try {
    const supplier = await getSupplierById(id)
    if (!supplier) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })
    return NextResponse.json({ supplier })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '供应商表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const before = await prisma.cosSupplier.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })

    if (parsed.data.code && parsed.data.code !== before.code) {
      const codeTaken = await prisma.cosSupplier.findUnique({ where: { code: parsed.data.code } })
      if (codeTaken) return NextResponse.json({ error: '供应商编码已存在' }, { status: 409 })
    }

    const supplier = await prisma.cosSupplier.update({
      where: { id },
      data: {
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.contactPerson !== undefined ? { contactPerson: nullableText(parsed.data.contactPerson) } : {}),
        ...(parsed.data.contactInfo !== undefined ? { contactInfo: nullableText(parsed.data.contactInfo) } : {}),
        ...(parsed.data.address !== undefined ? { address: nullableText(parsed.data.address) } : {}),
        ...(parsed.data.shippingAddress !== undefined ? { shippingAddress: nullableText(parsed.data.shippingAddress) } : {}),
      },
      include: supplierInclude,
    })

    await logAudit(session!.user.id, 'UPDATE', 'CosSupplier', supplier.id, before, supplier)
    return NextResponse.json({ supplier: serializeSupplier(supplier) })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '供应商表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const { id } = await params

  try {
    const before = await prisma.cosSupplier.findUnique({
      where: { id },
      include: { files: { select: { storageKey: true } } },
    })
    if (!before) return NextResponse.json({ error: '供应商不存在' }, { status: 404 })

    for (const file of before.files) {
      await deleteCosSupplierFile(file.storageKey)
    }

    await prisma.cosSupplier.delete({ where: { id } })
    await logAudit(session!.user.id, 'DELETE', 'CosSupplier', id, before, null)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '供应商表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
