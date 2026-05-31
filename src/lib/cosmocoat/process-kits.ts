import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

export const kitInclude = {
  products: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  tests: {
    orderBy: [{ testDate: 'desc' }, { id: 'desc' }],
  },
  createdByUser: {
    select: { id: true, nameEn: true, email: true },
  },
} satisfies Prisma.CosProcessKitInclude

export type ProcessKitWithRelations = Prisma.CosProcessKitGetPayload<{
  include: typeof kitInclude
}>

export function serializeProcessKit(kit: ProcessKitWithRelations) {
  return {
    id: kit.id,
    code: kit.code,
    name: kit.name,
    description: kit.description,
    status: kit.status,
    createdBy: kit.createdBy,
    createdByName: kit.createdByName,
    createdAt: kit.createdAt.toISOString(),
    updatedAt: kit.updatedAt.toISOString(),
    productCount: kit.products.length,
    testCount: kit.tests.length,
    products: kit.products.map(p => ({
      id: p.id,
      kitId: p.kitId,
      productId: p.productId,
      productName: p.productName,
      sortOrder: p.sortOrder,
      quantityRatio: p.quantityRatio,
      usageMethod: p.usageMethod,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    tests: kit.tests.map(t => ({
      id: t.id,
      kitId: t.kitId,
      testType: t.testType,
      testResult: t.testResult,
      testDate: t.testDate.toISOString(),
      testerName: t.testerName,
      testerId: t.testerId,
      reportLink: t.reportLink,
      testNotes: t.testNotes,
      passedAt: t.passedAt?.toISOString() ?? null,
    })),
    createdByUser: kit.createdByUser
      ? { id: kit.createdByUser.id, name: kit.createdByUser.nameEn, email: kit.createdByUser.email }
      : null,
  }
}

export async function getProcessKitById(id: string) {
  const kit = await prisma.cosProcessKit.findUnique({
    where: { id },
    include: kitInclude,
  })
  if (!kit) return null
  return serializeProcessKit(kit)
}

export async function generateProcessKitCode(): Promise<string> {
  const now = new Date()
  const prefix = `GY${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const count = await prisma.cosProcessKit.count({
    where: { code: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(3, '0')}`
}
