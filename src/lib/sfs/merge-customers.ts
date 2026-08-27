import type { PrismaClient } from '@prisma/client'
import { deleteSfsCustomerContractFile } from '@/lib/sfs/customer-contracts'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export type SfsCustomerMergeInput = {
  /** Target SfsCustomer.id (must already exist). */
  targetCustomerId: string
  /** Source SfsCustomer.id values to merge into the target (must not include target). */
  sourceCustomerIds: string[]
  /**
   * When true (default), orders that belonged to a source user's login are reassigned
   * to the target customer's linked user so the client dashboard sees them.
   */
  reassignOrderUsers?: boolean
  /** When true (default), delete emptied source customer profiles after merge. */
  deleteSourceProfiles?: boolean
  /** When true (default), deactivate source login users after unbinding. */
  deactivateSourceUsers?: boolean
}

export type SfsCustomerMergeResult = {
  targetCustomerId: string
  targetUserId: string | null
  mergedSourceCustomerIds: string[]
  movedOrderIds: string[]
  movedContractIds: string[]
  movedPriceOverrideCount: number
  deletedSourceCustomerIds: string[]
  deactivatedUserIds: string[]
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)))
}

export async function mergeSfsCustomers(
  prisma: PrismaClient,
  input: SfsCustomerMergeInput,
): Promise<SfsCustomerMergeResult> {
  const sourceCustomerIds = uniqueIds(input.sourceCustomerIds).filter(id => id !== input.targetCustomerId)
  if (sourceCustomerIds.length === 0) {
    throw new Error('Select at least one other customer profile to merge.')
  }

  const reassignOrderUsers = input.reassignOrderUsers !== false
  const deleteSourceProfiles = input.deleteSourceProfiles !== false
  const deactivateSourceUsers = input.deactivateSourceUsers !== false

  const target = await prisma.sfsCustomer.findUnique({
    where: { id: input.targetCustomerId },
    select: { id: true, userId: true, name: true },
  })
  if (!target) throw new Error('Target customer profile not found.')

  const sources = await prisma.sfsCustomer.findMany({
    where: { id: { in: sourceCustomerIds } },
    select: {
      id: true,
      userId: true,
      name: true,
      contracts: { select: { id: true, storageKey: true } },
      priceOverrides: { select: { id: true, category: true, value: true } },
      multiDiamondDiscountTiers: { select: { id: true, minDiamondCount: true } },
    },
  })
  if (sources.length !== sourceCustomerIds.length) {
    throw new Error('One or more source customer profiles were not found.')
  }

  const sourceUserIds = uniqueIds(sources.map(s => s.userId).filter((id): id is string => Boolean(id)))

  const ordersToMove = await prisma.sfsOrder.findMany({
    where: {
      OR: [
        { customerId: { in: sourceCustomerIds } },
        ...(sourceUserIds.length ? [{ userId: { in: sourceUserIds } }] : []),
      ],
    },
    select: { id: true },
  })
  const movedOrderIds = ordersToMove.map(o => o.id)

  const contractStorageKeysToDelete: string[] = []

  const result = await prisma.$transaction(async (tx: Tx) => {
    if (movedOrderIds.length > 0) {
      await tx.sfsOrder.updateMany({
        where: { id: { in: movedOrderIds } },
        data: {
          customerId: target.id,
          ...(reassignOrderUsers && target.userId ? { userId: target.userId } : {}),
        },
      })
    }

    const movedContractIds: string[] = []
    for (const source of sources) {
      if (source.contracts.length === 0) continue
      await tx.sfsCustomerContract.updateMany({
        where: { customerId: source.id },
        data: { customerId: target.id },
      })
      movedContractIds.push(...source.contracts.map(c => c.id))
    }

    let movedPriceOverrideCount = 0
    const existingOverrides = await tx.sfsCustomerPriceOverride.findMany({
      where: { customerId: target.id },
      select: { category: true, value: true },
    })
    const existingKeys = new Set(existingOverrides.map(o => `${o.category}::${o.value}`))

    for (const source of sources) {
      for (const override of source.priceOverrides) {
        const key = `${override.category}::${override.value}`
        if (existingKeys.has(key)) {
          await tx.sfsCustomerPriceOverride.delete({ where: { id: override.id } })
          continue
        }
        await tx.sfsCustomerPriceOverride.update({
          where: { id: override.id },
          data: { customerId: target.id },
        })
        existingKeys.add(key)
        movedPriceOverrideCount += 1
      }
    }

    const targetDiscountCount = await tx.sfsCustomerMultiDiamondDiscountTier.count({
      where: { customerId: target.id },
    })
    for (const source of sources) {
      if (source.multiDiamondDiscountTiers.length === 0) continue
      if (targetDiscountCount > 0) {
        await tx.sfsCustomerMultiDiamondDiscountTier.deleteMany({ where: { customerId: source.id } })
      } else {
        await tx.sfsCustomerMultiDiamondDiscountTier.updateMany({
          where: { customerId: source.id },
          data: { customerId: target.id },
        })
      }
    }

    const deletedSourceCustomerIds: string[] = []
    const deactivatedUserIds: string[] = []

    for (const source of sources) {
      if (source.userId) {
        await tx.sfsCustomer.update({
          where: { id: source.id },
          data: { userId: null },
        })
      }

      const remainingOrders = await tx.sfsOrder.count({
        where: {
          OR: [
            { customerId: source.id },
            ...(source.userId ? [{ userId: source.userId }] : []),
          ],
        },
      })

      if (deleteSourceProfiles && remainingOrders === 0) {
        const leftoverContracts = await tx.sfsCustomerContract.findMany({
          where: { customerId: source.id },
          select: { storageKey: true },
        })
        contractStorageKeysToDelete.push(...leftoverContracts.map(c => c.storageKey))
        await tx.sfsCustomerContract.deleteMany({ where: { customerId: source.id } })
        await tx.sfsCustomerPriceOverride.deleteMany({ where: { customerId: source.id } })
        await tx.sfsCustomerMultiDiamondDiscountTier.deleteMany({ where: { customerId: source.id } })
        await tx.sfsCustomer.delete({ where: { id: source.id } })
        deletedSourceCustomerIds.push(source.id)
      }

      if (deactivateSourceUsers && source.userId && source.userId !== target.userId) {
        await tx.user.update({
          where: { id: source.userId },
          data: { isActive: false },
        })
        deactivatedUserIds.push(source.userId)
      }
    }

    return {
      targetCustomerId: target.id,
      targetUserId: target.userId,
      mergedSourceCustomerIds: sourceCustomerIds,
      movedOrderIds,
      movedContractIds: uniqueIds(movedContractIds),
      movedPriceOverrideCount,
      deletedSourceCustomerIds,
      deactivatedUserIds: uniqueIds(deactivatedUserIds),
    }
  })

  for (const storageKey of contractStorageKeysToDelete) {
    await deleteSfsCustomerContractFile(storageKey).catch(() => undefined)
  }

  return result
}

/** Resolve admin list row ids (`user:…` / `customer:…`) to an existing SfsCustomer.id, creating a profile for a bare user when needed. */
export async function resolveOrCreateSfsCustomerId(
  prisma: PrismaClient,
  rowId: string,
  createdById: string,
): Promise<string> {
  if (rowId.startsWith('customer:')) {
    const customerId = rowId.slice('customer:'.length)
    const existing = await prisma.sfsCustomer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!existing) throw new Error('Customer profile not found.')
    return existing.id
  }

  if (rowId.startsWith('user:')) {
    const userId = rowId.slice('user:'.length)
    const existing = await prisma.sfsCustomer.findUnique({ where: { userId }, select: { id: true } })
    if (existing) return existing.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nameEn: true, phone: true, mailingAddress: true },
    })
    if (!user) throw new Error('User account not found.')

    const created = await prisma.sfsCustomer.create({
      data: {
        userId: user.id,
        name: user.nameEn,
        email: user.email,
        phone: user.phone,
        mailingAddress: user.mailingAddress,
        createdById,
      },
      select: { id: true },
    })
    return created.id
  }

  throw new Error('Invalid customer row id.')
}
