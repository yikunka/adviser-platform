import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const { error } = await requireRole('STAFF', { adminMenu: 'kyc' })
  if (error) return error

  const persons = await prisma.keyPerson.findMany({
    orderBy: { nameEn: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameZh: true,
      idType: true,
      idNumber: true,
      nationality: true,
      dateOfBirth: true,
      placeOfBirth: true,
      placeOfIssue: true,
      homeAddress: true,
      contactAddress: true,
      kycStatus: true,
    },
  })

  return NextResponse.json(persons)
}
