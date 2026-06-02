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

/** Build billing fields from an approved KYC identity. */
export async function keyPersonBillingSnapshot(keyPersonId: string): Promise<CompanyBillingSnapshot | null> {
  const person = await prisma.keyPerson.findFirst({
    where: { id: keyPersonId, kycStatus: 'APPROVED' },
    select: {
      nameEn: true,
      nameZh: true,
      contactAddress: true,
      homeAddress: true,
      email: true,
    },
  })
  if (!person) return null

  const billToName = person.nameEn || person.nameZh || 'Client'
  const billToAddress =
    person.contactAddress?.trim() ||
    person.homeAddress?.trim() ||
    null
  const billToEmail = person.email?.trim() || null

  return { billToName, billToAddress, billToEmail }
}
