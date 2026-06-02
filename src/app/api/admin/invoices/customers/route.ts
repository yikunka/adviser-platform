import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'
import { assertCompanyAccessible, buildCompanyAccessWhere, resolveCompanyAccess } from '@/lib/company-access'
import { companyBillingSnapshot, keyPersonBillingSnapshot } from '@/lib/invoice/company-billing'

type InvoiceCustomerOption = {
  type: 'COMPANY' | 'INDIVIDUAL'
  id: string
  label: string
  subtitle: string | null
  billToName: string
  billToAddress: string | null
  billToEmail: string | null
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
  const accessFilter = buildCompanyAccessWhere(access)

  const companyWhere: Prisma.CompanyWhereInput = {
    ...(accessFilter ?? {}),
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameZh: { contains: q, mode: 'insensitive' } },
            { companyCode: { contains: q, mode: 'insensitive' } },
            { companyNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const keyPersonWhere: Prisma.KeyPersonWhereInput = {
    kycStatus: 'APPROVED',
    ...(q
      ? {
          OR: [
            { kycCode: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameZh: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { idNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [companies, keyPersons] = await Promise.all([
    prisma.company.findMany({
      where: companyWhere,
      select: {
        id: true,
        nameEn: true,
        nameZh: true,
        companyCode: true,
        companyNumber: true,
        registeredAddress: true,
        clientUser: { select: { nameEn: true, email: true, mailingAddress: true } },
      },
      orderBy: [{ companyCode: 'asc' }, { nameEn: 'asc' }],
      take: 200,
    }),
    prisma.keyPerson.findMany({
      where: keyPersonWhere,
      select: {
        id: true,
        kycCode: true,
        nameEn: true,
        nameZh: true,
        idType: true,
        idNumber: true,
        contactAddress: true,
        homeAddress: true,
        email: true,
      },
      orderBy: [{ kycApprovedAt: { sort: 'desc', nulls: 'last' } }, { nameEn: 'asc' }],
      take: 200,
    }),
  ])

  const companyCustomers: InvoiceCustomerOption[] = companies.map(company => {
    const client = company.clientUser
    return {
      type: 'COMPANY',
      id: company.id,
      label: `${company.companyCode ? `${company.companyCode} - ` : ''}${company.nameEn}`,
      subtitle: company.companyNumber ? `CR No. ${company.companyNumber}` : null,
      billToName: company.nameEn || company.nameZh || client?.nameEn || 'Client',
      billToAddress: company.registeredAddress?.trim() || client?.mailingAddress?.trim() || null,
      billToEmail: client?.email ?? null,
    }
  })

  const individualCustomers: InvoiceCustomerOption[] = keyPersons.map(person => ({
    type: 'INDIVIDUAL',
    id: person.id,
    label: `${person.kycCode ? `${person.kycCode} - ` : ''}${person.nameEn || person.nameZh || 'Client'}`,
    subtitle: [person.idType, person.idNumber].filter(Boolean).join(' ') || person.email || null,
    billToName: person.nameEn || person.nameZh || 'Client',
    billToAddress: person.contactAddress?.trim() || person.homeAddress?.trim() || null,
    billToEmail: person.email?.trim() || null,
  }))

  return NextResponse.json({ customers: [...companyCustomers, ...individualCustomers] })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('STAFF', { adminMenu: 'invoices' })
  if (error) return error

  const body = await req.json().catch(() => null) as { type?: unknown; id?: unknown } | null
  const type = body?.type
  const id = body?.id
  if ((type !== 'COMPANY' && type !== 'INDIVIDUAL') || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  if (type === 'COMPANY') {
    const access = await resolveCompanyAccess(session!.user.id, session!.user.role)
    if (!(await assertCompanyAccessible(access, id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const billing = type === 'COMPANY'
    ? await companyBillingSnapshot(id)
    : await keyPersonBillingSnapshot(id)
  if (!billing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  return NextResponse.json(billing)
}
