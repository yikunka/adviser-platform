import { prisma } from '@/lib/db/prisma'

export type CompanyBillingSnapshot = {
  billToName: string
  billToAddress: string | null
  billToEmail: string | null
}

/** Build billing fields from company + linked client user. */
export async function companyBillingSnapshot(companyId: string): Promise<CompanyBillingSnapshot | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      nameEn: true,
      nameZh: true,
      registeredAddress: true,
      clientUser: { select: { nameEn: true, email: true, mailingAddress: true } },
    },
  })
  if (!company) return null

  const client = company.clientUser
  const billToName = company.nameEn || company.nameZh || client?.nameEn || 'Client'
  const billToAddress =
    company.registeredAddress?.trim() ||
    client?.mailingAddress?.trim() ||
    null
  const billToEmail = client?.email ?? null

  return { billToName, billToAddress, billToEmail }
}
