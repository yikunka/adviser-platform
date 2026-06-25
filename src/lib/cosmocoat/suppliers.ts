import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export type CosSupplierRow = {
  id: string
  code: string
  name: string
  contactPerson: string | null
  contactInfo: string | null
  address: string | null
  shippingAddress: string | null
  hasBusinessLicense: boolean
  hasQualityGuarantee: boolean
  createdById: string | null
  createdAt: string
  updatedAt: string
}

const supplierInclude = {
  files: {
    select: {
      kind: true,
    },
  },
} as const

export function serializeSupplier(supplier: {
  id: string
  code: string
  name: string
  contactPerson: string | null
  contactInfo: string | null
  address: string | null
  shippingAddress: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
  files?: { kind: string }[]
}): CosSupplierRow {
  const fileKinds = new Set((supplier.files ?? []).map(file => file.kind))

  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    contactInfo: supplier.contactInfo,
    address: supplier.address,
    shippingAddress: supplier.shippingAddress,
    hasBusinessLicense: fileKinds.has('BUSINESS_LICENSE'),
    hasQualityGuarantee: fileKinds.has('QUALITY_GUARANTEE'),
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

function formatSupplierCode(value: number) {
  return `SC${String(value).padStart(4, '0')}`
}

export async function generateSupplierCodeForTx(
  tx: Pick<Prisma.TransactionClient, 'cosSupplier'>,
  reservedCodes?: Set<string>,
): Promise<string> {
  const latest = await tx.cosSupplier.findFirst({
    where: { code: { startsWith: 'SC' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  let nextNumber = 1
  if (latest?.code) {
    const match = latest.code.match(/^SC(\d+)$/)
    if (match) nextNumber = parseInt(match[1], 10) + 1
  }

  while (true) {
    const code = formatSupplierCode(nextNumber)
    if (!reservedCodes?.has(code)) return code
    nextNumber += 1
  }
}

export async function generateSupplierCode(): Promise<string> {
  return generateSupplierCodeForTx(prisma)
}

export { supplierInclude }
