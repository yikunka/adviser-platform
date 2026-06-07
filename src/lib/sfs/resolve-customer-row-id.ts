import { prisma } from '@/lib/db/prisma'

export async function resolveSfsCustomerIdFromRowId(rowId: string): Promise<string | null> {
  if (rowId.startsWith('customer:')) return rowId.slice('customer:'.length)

  if (rowId.startsWith('user:')) {
    const userId = rowId.slice('user:'.length)
    const profile = await prisma.sfsCustomer.findUnique({ where: { userId }, select: { id: true } })
    return profile?.id ?? null
  }

  if (rowId.startsWith('missing-user:')) {
    const userId = rowId.slice('missing-user:'.length)
    const profile = await prisma.sfsCustomer.findUnique({ where: { userId }, select: { id: true } })
    return profile?.id ?? null
  }

  if (rowId.startsWith('order-email:')) {
    const key = rowId.slice('order-email:'.length)
    const order = await prisma.sfsOrder.findFirst({
      where: {
        OR: [{ id: key }, { email: { equals: key, mode: 'insensitive' } }],
        customerId: { not: null },
      },
      select: { customerId: true },
    })
    return order?.customerId ?? null
  }

  return null
}
