import { prisma } from '@/lib/db/prisma'

export type CosCustomerRow = {
  id: string
  code: string
  name: string
  userId: string | null
  phone: string | null
  address: string | null
  createdById: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    nameEn: string
    phone: string | null
    isActive: boolean
    emailVerified: string | null
  } | null
}

const customerInclude = {
  user: {
    select: {
      id: true,
      email: true,
      nameEn: true,
      phone: true,
      isActive: true,
      emailVerified: true,
    },
  },
} as const

export function serializeCustomer(customer: {
  id: string
  code: string
  name: string
  userId: string | null
  phone: string | null
  address: string | null
  createdById: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    email: string
    nameEn: string
    phone: string | null
    isActive: boolean
    emailVerified: Date | null
  } | null
}): CosCustomerRow {
  return {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    userId: customer.userId,
    phone: customer.phone,
    address: customer.address,
    createdById: customer.createdById,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    user: customer.user
      ? {
          ...customer.user,
          emailVerified: customer.user.emailVerified?.toISOString() ?? null,
        }
      : null,
  }
}

export async function getCustomerById(id: string) {
  const customer = await prisma.cosCustomer.findUnique({
    where: { id },
    include: customerInclude,
  })
  if (!customer) return null
  return serializeCustomer(customer)
}

export async function generateCustomerCode(): Promise<string> {
  const latest = await prisma.cosCustomer.findFirst({
    where: { code: { startsWith: 'KH' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  if (!latest?.code) return 'KH0001'

  const match = latest.code.match(/^KH(\d+)$/)
  if (match) {
    const lastNumber = parseInt(match[1], 10)
    return `KH${String(lastNumber + 1).padStart(4, '0')}`
  }

  return 'KH0001'
}

export { customerInclude }
