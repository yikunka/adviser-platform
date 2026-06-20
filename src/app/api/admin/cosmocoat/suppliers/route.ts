import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { logAudit } from '@/lib/audit/logger'
import {
  generateSupplierCode,
  serializeSupplier,
  supplierInclude,
} from '@/lib/cosmocoat/suppliers'
import { supplierListOrderBy } from '@/lib/cosmocoat/supplier-list-order'

const PAGE_SIZE = 20

const createSchema = z.object({
  code: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(200),
  contactInfo: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
})

function nullableText(v: string | null | undefined) {
  const text = (v ?? '').trim()
  return text ? text : null
}

function isMissingTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
}

export async function GET(req: NextRequest) {
  const { error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const skip = (page - 1) * PAGE_SIZE

  const where: Prisma.CosSupplierWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { contactInfo: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

  try {
    const [total, items] = await Promise.all([
      prisma.cosSupplier.count({ where }),
      prisma.cosSupplier.findMany({
        where,
        include: supplierInclude,
        orderBy: supplierListOrderBy(),
        skip,
        take: PAGE_SIZE,
      }),
    ])

    return NextResponse.json({
      suppliers: items.map(serializeSupplier),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '供应商表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'cosmocoatSuppliers' })
  if (error) return error

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const code = parsed.data.code?.trim() || await generateSupplierCode()
    const existing = await prisma.cosSupplier.findUnique({ where: { code } })
    if (existing) return NextResponse.json({ error: '供应商编码已存在' }, { status: 409 })

    const supplier = await prisma.cosSupplier.create({
      data: {
        code,
        name: parsed.data.name,
        contactInfo: nullableText(parsed.data.contactInfo),
        address: nullableText(parsed.data.address),
        createdById: session!.user.id,
      },
      include: supplierInclude,
    })

    await logAudit(session!.user.id, 'CREATE', 'CosSupplier', supplier.id, null, supplier)
    return NextResponse.json({ supplier: serializeSupplier(supplier) }, { status: 201 })
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: '供应商表不存在，请先运行数据库迁移' }, { status: 503 })
    }
    throw err
  }
}
