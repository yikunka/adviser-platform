import { prisma } from '@/lib/db/prisma'

/** Resolves companyId and denormalized groupId for a journal entry from company selection. */
export async function resolveJournalCompanyScope(companyId: string | null | undefined): Promise<{
  companyId: string | null
  groupId: string | null
}> {
  if (!companyId) return { companyId: null, groupId: null }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, groupId: true },
  })
  if (!company) return { companyId: null, groupId: null }

  return { companyId: company.id, groupId: company.groupId }
}
