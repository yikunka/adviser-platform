import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { generateKycDocxBuffer, kycDocumentFilename } from '@/lib/kyc/generateKycDocx'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const list = await prisma.keyPerson.findMany({
    where: { submittedByUserId: userId },
    orderBy: { createdAt: 'asc' },
  })

  if (list.length === 0) {
    const legacy = await prisma.keyPerson.findMany({
      where: {
        companyLinks: { some: { company: { clientUserId: userId } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (legacy.length === 0) {
      return NextResponse.json({ error: 'No KYC records to export' }, { status: 400 })
    }
    const buf = await generateKycDocxBuffer(legacy)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${kycDocumentFilename()}"`,
      },
    })
  }

  const buf = await generateKycDocxBuffer(list)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${kycDocumentFilename()}"`,
    },
  })
}
