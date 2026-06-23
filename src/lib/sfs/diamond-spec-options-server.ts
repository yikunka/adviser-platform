import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  getDefaultSfsOrderSpecOptions,
  groupSfsSpecOptions,
  type SfsOrderSpecOptions,
} from '@/lib/sfs/diamond-spec-options'

function isMissingSpecTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2021' || error.code === 'P2022')
}

export async function getSfsOrderSpecOptions(): Promise<SfsOrderSpecOptions> {
  try {
    const rows = await prisma.sfsDiamondSpecOption.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (rows.length === 0) return getDefaultSfsOrderSpecOptions()
    const grouped = groupSfsSpecOptions(rows)
    if (grouped.sources.length > 0) return grouped
    return {
      ...grouped,
      sources: getDefaultSfsOrderSpecOptions().sources,
    }
  } catch (error) {
    if (isMissingSpecTable(error)) return getDefaultSfsOrderSpecOptions()
    throw error
  }
}
