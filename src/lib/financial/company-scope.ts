import { prisma } from '@/lib/db/prisma'

export async function resolveJournalCompanyScope(companyId: string | null | undefined): Promise<{
  companyId: string
}> {
  if (!companyId) {
    throw new Error('Client company is required')
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  })

  if (!company) {
    throw new Error('Client company not found')
  }

  return { companyId: company.id }
}
