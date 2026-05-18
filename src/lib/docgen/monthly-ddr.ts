import { prisma } from '@/lib/db/prisma'
import { ensureMonthlyDdrDocument, findSystemDocumentUserId } from '@/lib/docgen/store'

export async function generateMonthlyDdrForActiveCompanies(date = new Date()) {
  const uploadedById = await findSystemDocumentUserId()
  if (!uploadedById) {
    return { generated: 0, skipped: 0, errors: ['No staff user available for document ownership.'] }
  }

  const companies = await prisma.company.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, nameEn: true },
    orderBy: { nameEn: 'asc' },
  })

  let generated = 0
  let skipped = 0
  const errors: string[] = []

  for (const company of companies) {
    try {
      const before = await prisma.document.findFirst({
        where: {
          companyId: company.id,
          documentType: 'DDR',
          effectiveDate: {
            gte: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
            lt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)),
          },
          deletedAt: null,
        },
        select: { id: true },
      })
      await ensureMonthlyDdrDocument(company.id, uploadedById, date)
      if (before) skipped += 1
      else generated += 1
    } catch (error) {
      errors.push(`${company.nameEn}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { generated, skipped, errors }
}
