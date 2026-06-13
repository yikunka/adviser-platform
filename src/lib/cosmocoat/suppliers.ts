import { prisma } from '@/lib/db/prisma'

export type CosSupplierRow = {
  id: string
  code: string
  name: string
  contactInfo: string | null
  address: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

const supplierInclude = {} as const

export function serializeSupplier(supplier: {
  id: string
  code: string
  name: string
  contactInfo: string | null
  address: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
}): CosSupplierRow {
  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    contactInfo: supplier.contactInfo,
    address: supplier.address,
    createdById: supplier.createdById,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  }
}

export async function getSupplierById(id: string) {
  const supplier = await prisma.cosSupplier.findUnique({
    where: { id },
    include: supplierInclude,
  })
  if (!supplier) return null
  return serializeSupplier(supplier)
}

export async function generateSupplierCode(): Promise<string> {
  const latest = await prisma.cosSupplier.findFirst({
    where: { code: { startsWith: 'SC' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  if (!latest?.code) return 'SC0001'

  const match = latest.code.match(/^SC(\d+)$/)
  if (match) {
    const lastNumber = parseInt(match[1], 10)
    return `SC${String(lastNumber + 1).padStart(4, '0')}`
  }

  return 'SC0001'
}

export { supplierInclude }
